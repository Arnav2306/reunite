"""
Reunite Phase 2 â€” Comprehensive Recovery Workflow Test Suite
=============================================================
Covers:
  - Happy-path claim/handover flow (existing 6 tests preserved)
  - Security: student isolation, role authorization, private-field protection
  - OTP edge cases: expired, max-attempts, reuse, wrong OTP, hash storage
  - Audit cleanliness: no OTP/password/hash in audit details
  - Notification correctness and user isolation
  - Status-transition guards (can't approve REJECTED claim, etc.)
  - Admin dashboard stats (real DB counts, no hard-coding)
  - ORM efficiency (rough query-count guard on admin-list endpoint)
"""

from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from rest_framework.test import APIClient
from rest_framework import status as http_status
from django.test.utils import CaptureQueriesContext
from django.db import connection

from accounts.models import User
from items.models import FoundItem, ItemStatus
from collectionpoint.models import CollectionPoint
from pickup.models import Claim, ClaimStatus, OwnershipVerification, PickupRequest
from handovers.models import Handover, HandoverStatus
from handovers.services import generate_otp, MAX_OTP_ATTEMPTS
from audit.models import AuditLog
from notifications.models import Notification


# ---------------------------------------------------------------------------
# Shared fixture mixin
# ---------------------------------------------------------------------------

class BaseRecoveryFixture(TestCase):
    """Sets up shared users, collection point, and found items used across tests."""

    def setUp(self):
        self.client = APIClient()

        # Users
        self.student = User.objects.create_user(
            email='student1@college.edu',
            password='password123',
            name='Jane Student',
            role='student',
        )
        self.student2 = User.objects.create_user(
            email='student2@college.edu',
            password='password123',
            name='Bob Student',
            role='student',
        )
        self.custodian = User.objects.create_user(
            email='custodian@college.edu',
            password='password123',
            name='Staff Custodian',
            role='custodian',
            is_staff=True,
        )
        self.admin_user = User.objects.create_user(
            email='admin@college.edu',
            password='password123',
            name='Campus Admin',
            role='admin',
            is_staff=True,
        )

        # Collection Point
        self.cp = CollectionPoint.objects.create(
            public_id='cp-001',
            station_code='RNT-ST-01',
            building='Library',
            floor='1st Floor',
            station_type='HOD Office',
        )

        # General Found Item (risk_tier=0)
        self.general_item = FoundItem.objects.create(
            public_id='item-gen-001',
            user=self.custodian,
            title='Blue Water Bottle',
            category='Bottles',
            description='Metal hydro flask bottle left in canteen',
            found_location='Student Center Canteen',
            collection_point=self.cp,
            status=ItemStatus.SECURE_HOLD,
            risk_tier=0,
            is_published=True,
            serial_number='SN-PRIVATE-12345',
            secret_verification_info='Scratch on bottom left side',
            identifying_marks='Dent on lid',
            internal_notes='Handed over by security guard',
        )

        # Valuable Found Item (risk_tier=1)
        self.valuable_item = FoundItem.objects.create(
            public_id='item-val-002',
            user=self.custodian,
            title='iPhone 15 Pro',
            category='Electronics',
            description='Black iPhone 15 Pro with leather case',
            found_location='Library Study Room 3',
            collection_point=self.cp,
            status=ItemStatus.SECURE_HOLD,
            risk_tier=1,
            is_published=True,
            serial_number='APPLE-SN-998877',
            imei='358999112233445',
            secret_verification_info='Lockscreen wallpaper of a golden retriever',
        )

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    def _create_approved_claim_with_handover(self, student, item):
        """Approve a claim end-to-end and return (claim, pickup_req, handover)."""
        claim = Claim.objects.create(student=student, found_item=item)
        OwnershipVerification.objects.create(
            claim=claim, question='Q', student_answer='A'
        )
        self.client.force_authenticate(user=self.custodian)
        self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')
        claim.refresh_from_db()
        pr = PickupRequest.objects.get(claim=claim)
        handover = Handover.objects.get(pickup_request=pr)
        return claim, pr, handover


# ===========================================================================
# 1. ORIGINAL HAPPY-PATH TESTS (preserved, unchanged)
# ===========================================================================

class RecoveryWorkflowTestCase(BaseRecoveryFixture):
    """Original six tests â€” must all continue to pass."""

    def test_public_available_items_hides_private_fields(self):
        """Verify that public student endpoints hide serial numbers, IMEIs, and secret verification info."""
        self.client.force_authenticate(user=self.student)
        response = self.client.get('/api/items/available-items/')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        data = response.data if isinstance(response.data, list) else response.data.get('results', [])
        self.assertTrue(len(data) >= 2)

        for item in data:
            self.assertNotIn('serial_number', item)
            self.assertNotIn('imei', item)
            self.assertNotIn('secret_verification_info', item)
            self.assertNotIn('internal_notes', item)

    def test_student_claim_submission(self):
        """Verify student can create a claim and duplicate active claims are prevented."""
        self.client.force_authenticate(user=self.student)

        payload = {
            'found_item_id': self.general_item.public_id,
            'student_answer': 'My blue flask has a dent on top rim',
        }
        response = self.client.post('/api/pickup/claims/', payload)
        self.assertEqual(response.status_code, http_status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'PENDING')

        claim = Claim.objects.get(public_id=response.data['public_id'])
        self.assertEqual(claim.student, self.student)
        self.assertEqual(claim.verification.student_answer, payload['student_answer'])

        self.assertTrue(
            Notification.objects.filter(
                user=self.student, notification_type='CLAIM_SUBMITTED'
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.student, action='CLAIM_CREATED'
            ).exists()
        )

        # Duplicate claim
        dup_response = self.client.post('/api/pickup/claims/', payload)
        self.assertEqual(dup_response.status_code, http_status.HTTP_400_BAD_REQUEST)

    def test_unauthorized_student_cannot_access_admin_list(self):
        """Verify students cannot view staff claim verification queue."""
        self.client.force_authenticate(user=self.student)
        response = self.client.get('/api/pickup/claims/admin/admin-list/')
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)

    def test_staff_claim_approval_general_item(self):
        """Verify staff can approve general item claim, creating PickupRequest and non-OTP Handover."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        OwnershipVerification.objects.create(claim=claim, question='Test Q', student_answer='Test Ans')

        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)

        claim.refresh_from_db()
        self.assertEqual(claim.status, ClaimStatus.APPROVED)

        self.general_item.refresh_from_db()
        self.assertEqual(self.general_item.status, ItemStatus.READY_FOR_PICKUP)

        pr = PickupRequest.objects.get(claim=claim)
        self.assertEqual(pr.status, ItemStatus.READY_FOR_PICKUP)

        handover = Handover.objects.get(pickup_request=pr)
        self.assertFalse(handover.is_valuable)
        self.assertEqual(handover.status, HandoverStatus.READY)

    def test_general_item_handover_completion(self):
        """Verify custodian can confirm physical collection of general item without OTP."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.custodian)
        self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')

        pr = PickupRequest.objects.get(claim=claim)
        handover = Handover.objects.get(pickup_request=pr)

        res = self.client.post(f'/api/handovers/admin/{handover.public_id}/confirm-collection/')
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)

        handover.refresh_from_db()
        self.assertEqual(handover.status, HandoverStatus.COMPLETED)
        self.assertEqual(handover.custodian, self.custodian)

        self.general_item.refresh_from_db()
        self.assertEqual(self.general_item.status, ItemStatus.RESOLVED)

    def test_valuable_item_otp_handover_flow(self):
        """Verify complete valuable item OTP lifecycle."""
        claim = Claim.objects.create(student=self.student, found_item=self.valuable_item)
        OwnershipVerification.objects.create(claim=claim, question='Wallpaper?', student_answer='Golden Retriever')

        self.client.force_authenticate(user=self.custodian)
        app_res = self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')
        self.assertEqual(app_res.status_code, http_status.HTTP_200_OK)

        pr = PickupRequest.objects.get(claim=claim)
        handover = Handover.objects.get(pickup_request=pr)
        self.assertTrue(handover.is_valuable)
        self.assertEqual(handover.status, HandoverStatus.PENDING_OTP)
        self.assertTrue(handover.otp_hash)
        self.assertNotEqual(handover.otp_hash, '123456')

        # Wrong OTP
        wrong_res = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': '000000'}
        )
        self.assertEqual(wrong_res.status_code, http_status.HTTP_400_BAD_REQUEST)
        handover.refresh_from_db()
        self.assertEqual(handover.failed_otp_attempts, 1)

        # Generate a known OTP and verify correctly
        otp_code = generate_otp(handover)
        correct_res = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )
        self.assertEqual(correct_res.status_code, http_status.HTTP_200_OK)

        handover.refresh_from_db()
        self.assertEqual(handover.status, HandoverStatus.COMPLETED)
        self.assertTrue(handover.otp_used)

        self.valuable_item.refresh_from_db()
        self.assertEqual(self.valuable_item.status, ItemStatus.RESOLVED)

        # OTP reuse rejected
        reuse_res = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )
        self.assertEqual(reuse_res.status_code, http_status.HTTP_400_BAD_REQUEST)


# ===========================================================================
# 2. CLAIM SECURITY & ISOLATION
# ===========================================================================

class ClaimSecurityTests(BaseRecoveryFixture):
    """Student isolation and authorization boundary tests."""

    def test_unauthenticated_cannot_create_claim(self):
        """Unauthenticated requests to the claims endpoint must return 401 or 403."""
        response = self.client.post('/api/pickup/claims/', {
            'found_item_id': self.general_item.public_id,
            'student_answer': 'test',
        })
        self.assertIn(
            response.status_code,
            [http_status.HTTP_401_UNAUTHORIZED, http_status.HTTP_403_FORBIDDEN]
        )

    def test_custodian_cannot_create_student_claim(self):
        """Staff users (custodian role) must be rejected from the student claim endpoint."""
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post('/api/pickup/claims/', {
            'found_item_id': self.general_item.public_id,
            'student_answer': 'staff trying to create claim',
        })
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)

    def test_student_cannot_see_another_students_my_claims(self):
        """Student A's /my-claims/ must never include Student B's claims."""
        # Create claim for student2
        Claim.objects.create(student=self.student2, found_item=self.general_item)

        # Student1 queries my-claims â€” should get empty list
        self.client.force_authenticate(user=self.student)
        response = self.client.get('/api/pickup/claims/my-claims/')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        data = response.data if isinstance(response.data, list) else response.data.get('results', [])
        student_ids = {c.get('student', {}).get('email') if isinstance(c.get('student'), dict) else None
                       for c in data}
        self.assertNotIn(self.student2.email, student_ids)
        # More directly: all returned claims belong to student1
        for claim_data in data:
            # ClaimStudentSerializer does not expose 'student' field, so just assert count
            pass
        # Confirm student1 has zero claims
        self.assertEqual(len(data), 0)

    def test_student_my_claims_only_returns_own_claims(self):
        """Student A submits a claim; my-claims returns exactly that claim and not student2's."""
        self.client.force_authenticate(user=self.student)
        self.client.post('/api/pickup/claims/', {
            'found_item_id': self.general_item.public_id,
            'student_answer': 'mine',
        })
        # Student2 submits a claim on a different item path â€” but we only have two items;
        # student2 submits on valuable_item
        self.client.force_authenticate(user=self.student2)
        self.client.post('/api/pickup/claims/', {
            'found_item_id': self.valuable_item.public_id,
            'student_answer': 'mine too',
        })

        # Student1 should see exactly 1 claim
        self.client.force_authenticate(user=self.student)
        response = self.client.get('/api/pickup/claims/my-claims/')
        data = response.data if isinstance(response.data, list) else response.data.get('results', [])
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['found_item']['public_id'], self.general_item.public_id)

    def test_student_cannot_approve_claim(self):
        """Students must be forbidden from approving claims."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.student)
        response = self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)

    def test_student_cannot_reject_claim(self):
        """Students must be forbidden from rejecting claims."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.student)
        response = self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/reject/')
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)

    def test_db_constraint_prevents_duplicate_active_claims(self):
        """Database-level UniqueConstraint must prevent two active claims for same student+item."""
        from django.db import IntegrityError as DjangoIntegrityError
        Claim.objects.create(
            student=self.student,
            found_item=self.general_item,
            status=ClaimStatus.PENDING,
        )
        with self.assertRaises(DjangoIntegrityError):
            Claim.objects.create(
                student=self.student,
                found_item=self.general_item,
                status=ClaimStatus.PENDING,
            )

    def test_cancelled_claim_allows_new_claim(self):
        """A CANCELLED claim must not block creation of a new claim for the same student+item."""
        Claim.objects.create(
            student=self.student,
            found_item=self.general_item,
            status=ClaimStatus.CANCELLED,
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/pickup/claims/', {
            'found_item_id': self.general_item.public_id,
            'student_answer': 'New claim after cancellation',
        })
        self.assertEqual(response.status_code, http_status.HTTP_201_CREATED)

    def test_rejected_claim_allows_new_claim(self):
        """A REJECTED claim must not block creation of a new claim for the same student+item."""
        Claim.objects.create(
            student=self.student,
            found_item=self.general_item,
            status=ClaimStatus.REJECTED,
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/pickup/claims/', {
            'found_item_id': self.general_item.public_id,
            'student_answer': 'New claim after rejection',
        })
        self.assertEqual(response.status_code, http_status.HTTP_201_CREATED)

    def test_student_cannot_claim_resolved_item(self):
        """A RESOLVED item must not accept new claims."""
        self.general_item.status = ItemStatus.RESOLVED
        self.general_item.save()

        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/pickup/claims/', {
            'found_item_id': self.general_item.public_id,
            'student_answer': 'test',
        })
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)

    def test_claim_on_nonexistent_item_rejected(self):
        """Claiming a non-existent or unpublished item must return 400."""
        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/pickup/claims/', {
            'found_item_id': 'nonexistent-uuid',
            'student_answer': 'test',
        })
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)


# ===========================================================================
# 3. PRIVATE ITEM DATA PROTECTION
# ===========================================================================

class PrivateItemDataTests(BaseRecoveryFixture):
    """Verify the API never exposes private item fields to students."""

    PRIVATE_FIELDS = [
        'serial_number', 'imei', 'secret_verification_info',
        'internal_notes', 'identifying_marks',
    ]

    def test_available_items_excludes_all_private_fields(self):
        """Every item in the public catalog must omit ALL private identification fields."""
        self.client.force_authenticate(user=self.student)
        response = self.client.get('/api/items/available-items/')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        items = response.data if isinstance(response.data, list) else response.data.get('results', [])

        for item in items:
            for field in self.PRIVATE_FIELDS:
                self.assertNotIn(
                    field, item,
                    msg=f"Private field '{field}' leaked in public catalog response"
                )

    def test_my_claims_response_excludes_private_item_fields(self):
        """The found_item nested in my-claims response must not expose private fields."""
        self.client.force_authenticate(user=self.student)
        self.client.post('/api/pickup/claims/', {
            'found_item_id': self.general_item.public_id,
            'student_answer': 'test',
        })
        response = self.client.get('/api/pickup/claims/my-claims/')
        claims = response.data if isinstance(response.data, list) else response.data.get('results', [])
        self.assertTrue(len(claims) >= 1)

        for claim in claims:
            found_item = claim.get('found_item', {})
            for field in self.PRIVATE_FIELDS:
                self.assertNotIn(
                    field, found_item,
                    msg=f"Private field '{field}' leaked in student my-claims response"
                )

    def test_admin_can_see_private_item_fields(self):
        """Staff-facing admin claim list must include private fields for verification purposes."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.custodian)
        response = self.client.get('/api/pickup/claims/admin/admin-list/')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        claims_data = response.data if isinstance(response.data, list) else response.data.get('results', [])
        self.assertTrue(len(claims_data) >= 1)

        found_item_data = claims_data[0].get('found_item', {})
        # Admin serializer should include at least serial_number
        self.assertIn('serial_number', found_item_data)


# ===========================================================================
# 4. OTP EDGE CASES
# ===========================================================================

class OTPEdgeCaseTests(BaseRecoveryFixture):
    """Comprehensive OTP security edge-case tests."""

    def _create_valuable_handover(self):
        """Create an approved valuable claim and return (handover, otp_code)."""
        claim, pr, handover = self._create_approved_claim_with_handover(
            self.student, self.valuable_item
        )
        otp_code = generate_otp(handover)
        return handover, otp_code

    def test_otp_hash_not_plaintext(self):
        """Verify the DB stores a hash, not the 6-digit plaintext OTP."""
        handover, otp_code = self._create_valuable_handover()
        handover.refresh_from_db()
        # Hash must not equal the plaintext OTP
        self.assertNotEqual(handover.otp_hash, otp_code)
        # Hash must look like a Django password hash (contains $ separators)
        self.assertIn('$', handover.otp_hash)
        # otp_hash must not be exactly 6 digits
        self.assertNotRegex(handover.otp_hash, r'^\d{6}$')

    def test_expired_otp_fails(self):
        """OTP past its expiry window must be rejected and handover must not complete."""
        handover, otp_code = self._create_valuable_handover()

        # Force expiry into the past
        handover.otp_expires_at = timezone.now() - timedelta(hours=1)
        handover.save()

        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)

        handover.refresh_from_db()
        self.assertNotEqual(handover.status, HandoverStatus.COMPLETED)

        self.valuable_item.refresh_from_db()
        self.assertNotEqual(self.valuable_item.status, ItemStatus.RESOLVED)

    def test_max_otp_attempts_locks_handover(self):
        """After MAX_OTP_ATTEMPTS wrong OTPs the handover must be locked (FAILED)."""
        handover, otp_code = self._create_valuable_handover()

        self.client.force_authenticate(user=self.custodian)
        for i in range(MAX_OTP_ATTEMPTS):
            res = self.client.post(
                f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': '000000'}
            )
            self.assertEqual(res.status_code, http_status.HTTP_400_BAD_REQUEST)

        handover.refresh_from_db()
        self.assertEqual(handover.status, HandoverStatus.FAILED)
        self.assertEqual(handover.failed_otp_attempts, MAX_OTP_ATTEMPTS)

        # Further attempts must still fail
        late_res = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )
        self.assertEqual(late_res.status_code, http_status.HTTP_400_BAD_REQUEST)

    def test_wrong_otp_increments_failed_attempts(self):
        """Each wrong OTP attempt must increment failed_otp_attempts by exactly 1."""
        handover, _ = self._create_valuable_handover()

        self.client.force_authenticate(user=self.custodian)
        for expected_count in range(1, 3):
            self.client.post(
                f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': '000000'}
            )
            handover.refresh_from_db()
            self.assertEqual(handover.failed_otp_attempts, expected_count)

    def test_otp_reuse_rejected_after_completion(self):
        """Using the same OTP after a successful verification must be rejected."""
        handover, otp_code = self._create_valuable_handover()

        self.client.force_authenticate(user=self.custodian)
        # Successful first use
        res1 = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )
        self.assertEqual(res1.status_code, http_status.HTTP_200_OK)

        handover.refresh_from_db()
        self.assertEqual(handover.status, HandoverStatus.COMPLETED)
        self.assertTrue(handover.otp_used)

        # Reuse attempt
        res2 = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )
        self.assertEqual(res2.status_code, http_status.HTTP_400_BAD_REQUEST)

    def test_otp_verify_api_response_contains_no_otp_plaintext(self):
        """The verify-otp success/failure API response must not include plaintext OTP."""
        handover, otp_code = self._create_valuable_handover()

        self.client.force_authenticate(user=self.custodian)
        res = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )
        self.assertEqual(res.status_code, http_status.HTTP_200_OK)

        response_str = str(res.data)
        # otp_hash and otp_code must not appear in the response payload
        self.assertNotIn(otp_code, response_str)
        self.assertNotIn(handover.otp_hash, response_str)

    def test_student_cannot_call_verify_otp(self):
        """Only staff may call the verify-otp endpoint; students must get 403."""
        handover, otp_code = self._create_valuable_handover()

        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)

    def test_student_cannot_call_confirm_collection(self):
        """Only staff may call confirm-collection; students must get 403."""
        claim, pr, handover = self._create_approved_claim_with_handover(
            self.student, self.general_item
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/confirm-collection/'
        )
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)

    def test_otp_expiry_duration_is_24_hours(self):
        """OTP expiry window must be 24 hours as documented in the service."""
        handover, _ = self._create_valuable_handover()
        handover.refresh_from_db()
        expected_expiry = timezone.now() + timedelta(hours=24)
        # Allow Â±5 seconds for test execution time
        delta = abs((handover.otp_expires_at - expected_expiry).total_seconds())
        self.assertLess(delta, 5, msg="OTP expiry must be 24 hours from generation time")


# ===========================================================================
# 5. AUDIT LOG CLEANLINESS
# ===========================================================================

class AuditLogCleanliness(BaseRecoveryFixture):
    """Verify audit logs contain useful event info but no sensitive secrets."""

    OTP_SUSPICIOUS_PATTERNS = ['otp_hash', 'otp_code', 'password', 'hash']

    def _details_clean(self, details: dict) -> bool:
        """Return True if details dict contains no OTP/password/hash keys."""
        for key in details:
            if any(pat in key.lower() for pat in self.OTP_SUSPICIOUS_PATTERNS):
                return False
        for value in details.values():
            if isinstance(value, str) and any(
                pat in value.lower() for pat in ['$pbkdf2', '$argon2', '$bcrypt']
            ):
                return False
        return True

    def test_claim_created_audit_is_clean(self):
        """CLAIM_CREATED audit must not contain OTP or hash data."""
        self.client.force_authenticate(user=self.student)
        self.client.post('/api/pickup/claims/', {
            'found_item_id': self.general_item.public_id,
            'student_answer': 'test answer',
        })
        log = AuditLog.objects.get(action='CLAIM_CREATED', actor=self.student)
        self.assertIn('item_title', log.details)
        self.assertTrue(self._details_clean(log.details))

    def test_claim_approved_audit_is_clean(self):
        """CLAIM_APPROVED audit must contain item/student info but no OTP data."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.custodian)
        self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')

        log = AuditLog.objects.get(action='CLAIM_APPROVED')
        self.assertIn('item_title', log.details)
        self.assertIn('student_email', log.details)
        self.assertTrue(self._details_clean(log.details))

    def test_claim_rejected_audit_is_clean(self):
        """CLAIM_REJECTED audit must not expose OTP or hash data."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.custodian)
        self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/reject/', {
            'admin_notes': 'Mismatch in description',
        })

        log = AuditLog.objects.get(action='CLAIM_REJECTED')
        self.assertIn('item_title', log.details)
        self.assertIn('reason', log.details)
        self.assertTrue(self._details_clean(log.details))

    def test_handover_completed_audit_contains_no_otp(self):
        """HANDOVER_COMPLETED audit for valuable item must not contain OTP plaintext or hash."""
        claim, pr, handover = self._create_approved_claim_with_handover(
            self.student, self.valuable_item
        )
        otp_code = generate_otp(handover)

        self.client.force_authenticate(user=self.custodian)
        self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )

        for log in AuditLog.objects.filter(action__in=['HANDOVER_COMPLETED', 'OTP_VERIFICATION_SUCCESS']):
            self.assertTrue(
                self._details_clean(log.details),
                msg=f"Audit log {log.action} contains sensitive data: {log.details}"
            )
            # otp_code itself must not appear in stringified details
            self.assertNotIn(otp_code, str(log.details))


# ===========================================================================
# 6. NOTIFICATION CORRECTNESS & ISOLATION
# ===========================================================================

class NotificationTests(BaseRecoveryFixture):
    """Verify notifications are created for the right users and correctly isolated."""

    def test_claim_submission_creates_notification_for_student(self):
        """Submitting a claim must create a CLAIM_SUBMITTED notification for the claimant."""
        self.client.force_authenticate(user=self.student)
        self.client.post('/api/pickup/claims/', {
            'found_item_id': self.general_item.public_id,
            'student_answer': 'test',
        })
        self.assertTrue(
            Notification.objects.filter(
                user=self.student,
                notification_type='CLAIM_SUBMITTED',
            ).exists()
        )

    def test_approval_creates_notification_for_student(self):
        """Approving a claim must create a CLAIM_APPROVED notification for the student."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.custodian)
        self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')

        self.assertTrue(
            Notification.objects.filter(
                user=self.student,
                notification_type='CLAIM_APPROVED',
            ).exists()
        )

    def test_rejection_creates_notification_for_student(self):
        """Rejecting a claim must create a CLAIM_REJECTED notification for the student."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.custodian)
        self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/reject/')

        self.assertTrue(
            Notification.objects.filter(
                user=self.student,
                notification_type='CLAIM_REJECTED',
            ).exists()
        )

    def test_handover_completion_creates_notification(self):
        """Completing a handover must create a HANDOVER_COMPLETED notification."""
        claim, pr, handover = self._create_approved_claim_with_handover(
            self.student, self.general_item
        )
        self.client.force_authenticate(user=self.custodian)
        self.client.post(f'/api/handovers/admin/{handover.public_id}/confirm-collection/')

        self.assertTrue(
            Notification.objects.filter(
                user=self.student,
                notification_type='HANDOVER_COMPLETED',
            ).exists()
        )

    def test_student_can_only_see_own_notifications(self):
        """GET /api/notifications/ must return only the authenticated user's notifications."""
        Notification.objects.create(
            user=self.student, title='For Student 1', message='msg', notification_type='INFO'
        )
        Notification.objects.create(
            user=self.student2, title='For Student 2', message='msg', notification_type='INFO'
        )

        self.client.force_authenticate(user=self.student)
        response = self.client.get('/api/notifications/')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        data = response.data if isinstance(response.data, list) else response.data.get('results', [])

        titles = {n['title'] for n in data}
        self.assertIn('For Student 1', titles)
        self.assertNotIn('For Student 2', titles)

    def test_student_cannot_mark_another_students_notification_as_read(self):
        """A student must not be able to mark a notification that belongs to another user."""
        other_notif = Notification.objects.create(
            user=self.student2, title='Private', message='msg', notification_type='INFO'
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post(f'/api/notifications/{other_notif.public_id}/read/')
        # Must be 403 or 404 â€” not 200
        self.assertNotEqual(response.status_code, http_status.HTTP_200_OK)

    def test_mark_notification_read(self):
        """A user can mark their own notification as read."""
        notif = Notification.objects.create(
            user=self.student, title='Test', message='msg', notification_type='INFO', read=False
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post(f'/api/notifications/{notif.public_id}/read/')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertTrue(notif.read)


# ===========================================================================
# 7. STATUS TRANSITION GUARDS
# ===========================================================================

class StatusTransitionTests(BaseRecoveryFixture):
    """Verify invalid state transitions are blocked."""

    def test_cannot_approve_already_approved_claim(self):
        """Approving an already-APPROVED claim must return 400."""
        claim = Claim.objects.create(
            student=self.student, found_item=self.general_item, status=ClaimStatus.APPROVED
        )
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)

    def test_cannot_approve_rejected_claim(self):
        """Approving an already-REJECTED claim must return 400."""
        claim = Claim.objects.create(
            student=self.student, found_item=self.general_item, status=ClaimStatus.REJECTED
        )
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)

    def test_cannot_reject_already_rejected_claim(self):
        """Rejecting an already-REJECTED claim must return 400."""
        claim = Claim.objects.create(
            student=self.student, found_item=self.general_item, status=ClaimStatus.REJECTED
        )
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/reject/')
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)

    def test_cannot_confirm_already_completed_handover(self):
        """Confirming an already-COMPLETED handover must return 400."""
        claim, pr, handover = self._create_approved_claim_with_handover(
            self.student, self.general_item
        )
        # Complete it once
        self.client.force_authenticate(user=self.custodian)
        self.client.post(f'/api/handovers/admin/{handover.public_id}/confirm-collection/')

        # Attempt to complete again
        response = self.client.post(f'/api/handovers/admin/{handover.public_id}/confirm-collection/')
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)


# ===========================================================================
# 8. ADMIN DASHBOARD STATISTICS
# ===========================================================================

class AdminDashboardStatsTests(BaseRecoveryFixture):
    """Admin stats must reflect real DB state and never return hardcoded values."""

    def _get_stats(self):
        self.client.force_authenticate(user=self.custodian)
        response = self.client.get('/api/items/admin-stats/')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        return response.data

    def test_stats_return_zero_with_no_claims(self):
        """With no claims in the DB, pending_claims must be 0."""
        stats = self._get_stats()
        self.assertEqual(stats['pending_claims'], 0)

    def test_stats_reflect_pending_claim(self):
        """Creating a PENDING claim must increment pending_claims by 1."""
        before = self._get_stats()['pending_claims']
        Claim.objects.create(student=self.student, found_item=self.general_item)
        after = self._get_stats()['pending_claims']
        self.assertEqual(after, before + 1)

    def test_stats_reflect_ready_for_pickup(self):
        """Approving a claim must move the item into ready_for_pickup count."""
        before = self._get_stats()['ready_for_pickup']
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.custodian)
        self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')
        after = self._get_stats()['ready_for_pickup']
        self.assertEqual(after, before + 1)

    def test_stats_reflect_pending_handovers(self):
        """Approving a claim creates a handover; pending_handovers must increment."""
        before = self._get_stats()['pending_handovers']
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.custodian)
        self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')
        after = self._get_stats()['pending_handovers']
        self.assertEqual(after, before + 1)

    def test_student_cannot_access_stats(self):
        """Stats endpoint must be staff-only; students get 403."""
        self.client.force_authenticate(user=self.student)
        response = self.client.get('/api/items/admin-stats/')
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)


# ===========================================================================
# 9. ORM EFFICIENCY â€” QUERY COUNT GUARD
# ===========================================================================

class ORMEfficiencyTests(BaseRecoveryFixture):
    """
    Rough query-count test to guard against N+1 regressions.
    Creates N claims and verifies the admin-list endpoint does not issue NÃ—M queries.
    """

    def test_admin_list_query_count_does_not_scale_with_n_claims(self):
        """
        With 5 claims, the admin-list endpoint should use significantly fewer than
        5 Ã— (number of relations) queries, confirming select_related/prefetch_related
        eliminates the N+1 pattern.
        """
        items = []
        # We need unique items; create 5 additional general items
        for i in range(5):
            it = FoundItem.objects.create(
                public_id=f'eff-item-{i}',
                user=self.custodian,
                title=f'Efficiency Item {i}',
                category='Test',
                description='desc',
                status=ItemStatus.SECURE_HOLD,
                risk_tier=0,
                is_published=True,
            )
            items.append(it)
            Claim.objects.create(student=self.student, found_item=it)

        self.client.force_authenticate(user=self.custodian)

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/pickup/claims/admin/admin-list/')
            self.assertEqual(response.status_code, http_status.HTTP_200_OK)
            num_queries = len(ctx.captured_queries)

        # With select_related + prefetch_related the query count should be well under
        # 5 Ã— 5 = 25. We assert < 20 as a generous but meaningful upper bound.
        self.assertLess(
            num_queries, 20,
            msg=(
                f"admin-list issued {num_queries} queries for 5 claims. "
                "N+1 regression suspected â€” check select_related/prefetch_related."
            )
        )


# ===========================================================================
# 10. UUID ROUTING REGRESSION TESTS
# ===========================================================================

class UUIDRoutingTests(BaseRecoveryFixture):
    """
    Explicit regression tests confirming that StaffClaimViewSet and
    HandoverStaffViewSet resolve objects by public_id (UUID), not by
    integer primary key, as required by the frontend API contract.
    """

    # --- Claim UUID routing ---

    def test_staff_approve_via_public_id_succeeds(self):
        """Staff can approve a PENDING claim using its public_id in the URL."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        OwnershipVerification.objects.create(claim=claim, question='Q', student_answer='A')
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        claim.refresh_from_db()
        self.assertEqual(claim.status, ClaimStatus.APPROVED)

    def test_staff_reject_via_public_id_succeeds(self):
        """Staff can reject a PENDING claim using its public_id in the URL."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(
            f'/api/pickup/claims/admin/{claim.public_id}/reject/',
            {'admin_notes': 'Description mismatch.'},
        )
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        claim.refresh_from_db()
        self.assertEqual(claim.status, ClaimStatus.REJECTED)

    def test_approve_with_wrong_uuid_returns_404(self):
        """Attempting to approve a claim with a non-existent public_id returns 404."""
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post('/api/pickup/claims/admin/00000000-0000-0000-0000-000000000000/approve/')
        self.assertEqual(response.status_code, http_status.HTTP_404_NOT_FOUND)

    def test_reject_with_wrong_uuid_returns_404(self):
        """Attempting to reject a claim with a non-existent public_id returns 404."""
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post('/api/pickup/claims/admin/00000000-0000-0000-0000-000000000000/reject/')
        self.assertEqual(response.status_code, http_status.HTTP_404_NOT_FOUND)

    def test_student_approve_via_public_id_is_forbidden(self):
        """Students are forbidden from approving claims via public_id URL."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.student)
        response = self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/approve/')
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)

    def test_student_reject_via_public_id_is_forbidden(self):
        """Students are forbidden from rejecting claims via public_id URL."""
        claim = Claim.objects.create(student=self.student, found_item=self.general_item)
        self.client.force_authenticate(user=self.student)
        response = self.client.post(f'/api/pickup/claims/admin/{claim.public_id}/reject/')
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)

    # --- Handover UUID routing ---

    def test_verify_otp_via_public_id_succeeds(self):
        """Staff can verify OTP for a valuable handover using its public_id in the URL."""
        claim, pr, handover = self._create_approved_claim_with_handover(
            self.student, self.valuable_item
        )
        otp_code = generate_otp(handover)
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        handover.refresh_from_db()
        self.assertEqual(handover.status, HandoverStatus.COMPLETED)

    def test_confirm_collection_via_public_id_succeeds(self):
        """Staff can confirm collection for a general handover using its public_id in the URL."""
        claim, pr, handover = self._create_approved_claim_with_handover(
            self.student, self.general_item
        )
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(f'/api/handovers/admin/{handover.public_id}/confirm-collection/')
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        handover.refresh_from_db()
        self.assertEqual(handover.status, HandoverStatus.COMPLETED)

    def test_verify_otp_with_wrong_uuid_returns_404(self):
        """Using a non-existent handover public_id for verify-otp returns 404."""
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(
            '/api/handovers/admin/00000000-0000-0000-0000-000000000000/verify-otp/',
            {'otp': '123456'},
        )
        self.assertEqual(response.status_code, http_status.HTTP_404_NOT_FOUND)

    def test_confirm_collection_with_wrong_uuid_returns_404(self):
        """Using a non-existent handover public_id for confirm-collection returns 404."""
        self.client.force_authenticate(user=self.custodian)
        response = self.client.post(
            '/api/handovers/admin/00000000-0000-0000-0000-000000000000/confirm-collection/'
        )
        self.assertEqual(response.status_code, http_status.HTTP_404_NOT_FOUND)

    def test_student_verify_otp_via_public_id_is_forbidden(self):
        """Students are forbidden from calling verify-otp even with correct public_id."""
        claim, pr, handover = self._create_approved_claim_with_handover(
            self.student, self.valuable_item
        )
        otp_code = generate_otp(handover)
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/verify-otp/', {'otp': otp_code}
        )
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)

    def test_student_confirm_collection_via_public_id_is_forbidden(self):
        """Students are forbidden from calling confirm-collection even with correct public_id."""
        claim, pr, handover = self._create_approved_claim_with_handover(
            self.student, self.general_item
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/confirm-collection/'
        )
        self.assertEqual(response.status_code, http_status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# Feedback and Audit Log Tests
# ---------------------------------------------------------------------------

class FeedbackAndAuditLogTests(BaseRecoveryFixture):
    def test_student_submit_feedback(self):
        self.client.force_authenticate(user=self.student)
        resp = self.client.post('/api/pickup/feedback/', {
            'rating': 5,
            'comment': 'Prompt retrieval and kind staff!',
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED)
        self.assertEqual(resp.data['rating'], 5)
        self.assertEqual(resp.data['comment'], 'Prompt retrieval and kind staff!')

    def test_feedback_summary_accessible_to_staff(self):
        from pickup.models import Feedback
        Feedback.objects.create(user=self.student, rating=5, comment='Great')
        Feedback.objects.create(user=self.student2, rating=4, comment='Good')

        self.client.force_authenticate(user=self.custodian)
        resp = self.client.get('/api/pickup/feedback/summary/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        self.assertEqual(resp.data['total_feedback'], 2)
        self.assertEqual(resp.data['average_rating'], 4.5)

    def test_audit_logs_staff_only(self):
        # Create an audit log
        AuditLog.objects.create(
            actor=self.custodian,
            action='HANDOVER_COMPLETED',
            target_type='Handover',
            target_id='some-id',
            details={'test': True}
        )

        # Student is blocked
        self.client.force_authenticate(user=self.student)
        resp = self.client.get('/api/audit/logs/')
        self.assertEqual(resp.status_code, http_status.HTTP_403_FORBIDDEN)

        # Staff can view
        self.client.force_authenticate(user=self.custodian)
        resp = self.client.get('/api/audit/logs/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        self.assertGreaterEqual(len(resp.data), 1)

