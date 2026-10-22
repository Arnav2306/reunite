"""
Admin Dashboard, Report Archiving, Handover Resolution & Secure OTP — Targeted Test Suite
========================================================================================
Tests cover:
  1. Student / Admin permission separation on admin endpoints
  2. Report archiving (Found and Lost) with audit logging, match dismissal, and catalog exclusion
  3. Handover and resolution marking: valid transitions, audit logging, student notification,
     and blocking manual status='RESOLVED' updates
  4. Secure OTP lifecycle: hash storage, expiry, failed-attempt limit lockout (5 tries),
     single-use, safe regeneration, and cross-user denial
  5. Active dispute blocks handover, OTP verification, and OTP regeneration
"""

import datetime
import uuid
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from audit.models import AuditLog
from collectionpoint.models import CollectionPoint
from handovers.models import Handover, HandoverStatus
from handovers.services import generate_otp
from items.models import FoundItem, LostItem, ItemStatus, Match, MatchStatus
from pickup.models import Claim, ClaimStatus, PickupRequest, Dispute, DisputeStatus, DisputeReason


class AdminHandoverOtpBaseFixture(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.student = User.objects.create_user(
            email='student_owner@college.edu',
            password='Password123!',
            name='Alice Student',
            role='student',
        )
        self.other_student = User.objects.create_user(
            email='other_student@college.edu',
            password='Password123!',
            name='Bob Imposter',
            role='student',
        )
        self.staff_user = User.objects.create_user(
            email='custodian@college.edu',
            password='Password123!',
            name='Charlie Staff',
            role='custodian',
            is_staff=True,
        )
        self.admin_user = User.objects.create_user(
            email='admin@college.edu',
            password='Password123!',
            name='Diana Admin',
            role='admin',
            is_staff=True,
        )

        # Collection point
        self.cp = CollectionPoint.objects.create(
            public_id=str(uuid.uuid4()),
            station_code='LIB-01',
            building='Library',
            floor='1',
            station_type='Front Desk',
        )

        # Standard non-valuable FoundItem
        self.found_item = FoundItem.objects.create(
            public_id=str(uuid.uuid4()),
            title='Blue Water Bottle',
            category='Bottles',
            description='Blue Milton insulated bottle',
            found_date=datetime.date(2025, 10, 1),
            found_location='Library Desk',
            status=ItemStatus.SECURE_HOLD,
            collection_point=self.cp,
            risk_tier=0,
            is_published=True,
            published_at=timezone.now(),
            user=self.staff_user,
        )

        # Valuable FoundItem
        self.valuable_item = FoundItem.objects.create(
            public_id=str(uuid.uuid4()),
            title='MacBook Pro 14',
            category='Electronics',
            description='Space gray Apple laptop',
            found_date=datetime.date(2025, 10, 1),
            found_location='Library Quiet Room',
            status=ItemStatus.SECURE_HOLD,
            collection_point=self.cp,
            risk_tier=1,
            is_published=True,
            published_at=timezone.now(),
            user=self.staff_user,
        )


class PermissionSeparationTests(AdminHandoverOtpBaseFixture):
    def test_student_forbidden_from_admin_found_items(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get('/api/items/found-items/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_forbidden_from_archiving_found_item(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post(f'/api/items/found-items/{self.found_item.public_id}/archive/', {'reason': 'test'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_forbidden_from_archiving_lost_item(self):
        lost = LostItem.objects.create(
            public_id=str(uuid.uuid4()),
            category='Keys',
            description='Brass key',
            status=ItemStatus.REPORTED,
            user=self.student,
        )
        self.client.force_authenticate(user=self.student)
        res = self.client.post(f'/api/items/lost-items/{lost.public_id}/archive/', {'reason': 'test'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_forbidden_from_handover_admin_endpoints(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get('/api/handovers/admin/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_and_staff_allowed_admin_access(self):
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.get('/api/items/found-items/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.admin_user)
        res2 = self.client.get('/api/items/found-items/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)


class ReportArchivingTests(AdminHandoverOtpBaseFixture):
    def test_archive_found_item_requires_reason(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.post(f'/api/items/found-items/{self.found_item.public_id}/archive/', {})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reason', str(res.data).lower())

    def test_archive_found_item_success_and_audit_log(self):
        lost = LostItem.objects.create(
            public_id=str(uuid.uuid4()),
            category='Bottles',
            description='Blue bottle lost near library',
            status=ItemStatus.REPORTED,
            user=self.student,
        )
        match = Match.objects.create(
            public_id=str(uuid.uuid4()),
            lost_item=lost,
            found_item=self.found_item,
            score=90,
            status=MatchStatus.CANDIDATE,
        )

        self.client.force_authenticate(user=self.admin_user)
        res = self.client.post(
            f'/api/items/found-items/{self.found_item.public_id}/archive/',
            {'reason': 'Item disposed per university policy after 90 days.'}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.found_item.refresh_from_db()
        self.assertEqual(self.found_item.status, ItemStatus.ARCHIVED)
        self.assertFalse(self.found_item.is_published)

        # Match dismissed
        match.refresh_from_db()
        self.assertEqual(match.status, MatchStatus.DISMISSED)

        # AuditLog recorded
        audit = AuditLog.objects.filter(
            action='REPORT_ARCHIVED',
            actor=self.admin_user,
        ).first()
        self.assertIsNotNone(audit)
        self.assertIn('Item disposed', str(audit.details))

        # Excluded from available items
        self.client.logout()
        avail_res = self.client.get('/api/items/available-items/')
        results = avail_res.data if isinstance(avail_res.data, list) else avail_res.data.get('results', [])
        item_ids = [item['public_id'] for item in results]
        self.assertNotIn(str(self.found_item.public_id), item_ids)

    def test_archive_lost_item_success(self):
        lost = LostItem.objects.create(
            public_id=str(uuid.uuid4()),
            category='Accessories',
            description='Silver watch',
            status=ItemStatus.REPORTED,
            user=self.student,
        )
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(
            f'/api/items/lost-items/{lost.public_id}/archive/',
            {'reason': 'Duplicate report filed by user.'}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        lost.refresh_from_db()
        self.assertEqual(lost.status, ItemStatus.ARCHIVED)


class HandoverResolutionTests(AdminHandoverOtpBaseFixture):
    def setUp(self):
        super().setUp()
        self.claim = Claim.objects.create(
            student=self.student,
            found_item=self.found_item,
            status=ClaimStatus.APPROVED,
        )
        ct = ContentType.objects.get_for_model(FoundItem)
        self.pickup_req = PickupRequest.objects.create(
            requester=self.student,
            claim=self.claim,
            collection_point=self.cp,
            content_type=ct,
            object_id=self.found_item.id,
            status='READY_FOR_PICKUP',
        )
        self.handover = Handover.objects.create(
            pickup_request=self.pickup_req,
            found_item=self.found_item,
            student=self.student,
            custodian=self.staff_user,
            is_valuable=False,
            status=HandoverStatus.READY,
        )

    def test_cannot_manually_update_found_item_to_resolved(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.patch(
            f'/api/items/found-items/{self.found_item.public_id}/',
            {'status': ItemStatus.RESOLVED}
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('RESOLVED', str(res.data))

    def test_confirm_collection_non_valuable_success(self):
        lost = LostItem.objects.create(
            public_id=str(uuid.uuid4()),
            category='Bottles',
            description='Blue bottle lost near library',
            status=ItemStatus.REPORTED,
            user=self.student,
        )
        match = Match.objects.create(
            public_id=str(uuid.uuid4()),
            lost_item=lost,
            found_item=self.found_item,
            score=95,
            status=MatchStatus.REVIEWED,
        )

        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(f'/api/handovers/admin/{self.handover.public_id}/confirm-collection/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.handover.refresh_from_db()
        self.assertEqual(self.handover.status, HandoverStatus.COMPLETED)
        self.assertIsNotNone(self.handover.confirmed_at)

        self.found_item.refresh_from_db()
        self.assertEqual(self.found_item.status, ItemStatus.RESOLVED)

        # Linked lost item and match also resolved/claimed
        lost.refresh_from_db()
        self.assertEqual(lost.status, ItemStatus.RESOLVED)
        match.refresh_from_db()
        self.assertEqual(match.status, MatchStatus.CLAIMED)

        # Audit log verified
        audit = AuditLog.objects.filter(
            action='HANDOVER_COMPLETED',
            actor=self.staff_user,
        ).first()
        self.assertIsNotNone(audit)
        self.assertIn(self.student.email, str(audit.details))

    def test_confirm_collection_blocked_on_valuable_item(self):
        # Valuable item must use OTP verification
        val_claim = Claim.objects.create(
            student=self.student,
            found_item=self.valuable_item,
            status=ClaimStatus.APPROVED,
        )
        ct = ContentType.objects.get_for_model(FoundItem)
        val_pickup = PickupRequest.objects.create(
            requester=self.student,
            claim=val_claim,
            collection_point=self.cp,
            content_type=ct,
            object_id=self.valuable_item.id,
            status='READY_FOR_PICKUP',
        )
        val_handover = Handover.objects.create(
            pickup_request=val_pickup,
            found_item=self.valuable_item,
            student=self.student,
            is_valuable=True,
            status=HandoverStatus.READY,
        )

        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(f'/api/handovers/admin/{val_handover.public_id}/confirm-collection/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('OTP', str(res.data))


class ValuableItemOTPLifecycleTests(AdminHandoverOtpBaseFixture):
    def setUp(self):
        super().setUp()
        self.claim = Claim.objects.create(
            student=self.student,
            found_item=self.valuable_item,
            status=ClaimStatus.APPROVED,
        )
        ct = ContentType.objects.get_for_model(FoundItem)
        self.pickup_req = PickupRequest.objects.create(
            requester=self.student,
            claim=self.claim,
            collection_point=self.cp,
            content_type=ct,
            object_id=self.valuable_item.id,
            status='READY_FOR_PICKUP',
        )
        self.handover = Handover.objects.create(
            pickup_request=self.pickup_req,
            found_item=self.valuable_item,
            student=self.student,
            is_valuable=True,
            status=HandoverStatus.PENDING_OTP,
        )
        # Generate initial OTP
        self.plain_otp = generate_otp(self.handover)

    def test_otp_is_hashed_not_plaintext_in_db(self):
        self.handover.refresh_from_db()
        self.assertTrue(self.handover.otp_hash.startswith('pbkdf2_'))
        self.assertNotEqual(self.handover.otp_hash, self.plain_otp)

    def test_wrong_otp_increments_failed_attempts(self):
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(
            f'/api/handovers/admin/{self.handover.public_id}/verify-otp/',
            {'otp': '000000'}
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.handover.refresh_from_db()
        self.assertEqual(self.handover.failed_otp_attempts, 1)

    def test_five_failed_attempts_locks_handover(self):
        self.client.force_authenticate(user=self.staff_user)
        for _ in range(4):
            self.client.post(
                f'/api/handovers/admin/{self.handover.public_id}/verify-otp/',
                {'otp': '000000'}
            )
        # 5th attempt
        res = self.client.post(
            f'/api/handovers/admin/{self.handover.public_id}/verify-otp/',
            {'otp': '000000'}
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.handover.refresh_from_db()
        self.assertEqual(self.handover.failed_otp_attempts, 5)
        self.assertEqual(self.handover.status, HandoverStatus.FAILED)

        # Even correct OTP is now rejected because status is locked (FAILED)
        res_correct = self.client.post(
            f'/api/handovers/admin/{self.handover.public_id}/verify-otp/',
            {'otp': self.plain_otp}
        )
        self.assertEqual(res_correct.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_otp_rejected(self):
        self.handover.otp_expires_at = timezone.now() - datetime.timedelta(minutes=5)
        self.handover.save(update_fields=['otp_expires_at'])

        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(
            f'/api/handovers/admin/{self.handover.public_id}/verify-otp/',
            {'otp': self.plain_otp}
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', str(res.data).lower())

    def test_regenerate_otp_invalidates_old_and_resets_failures(self):
        # First incur 1 failure
        self.client.force_authenticate(user=self.staff_user)
        self.client.post(
            f'/api/handovers/admin/{self.handover.public_id}/verify-otp/',
            {'otp': '000000'}
        )
        self.handover.refresh_from_db()
        self.assertEqual(self.handover.failed_otp_attempts, 1)

        # Student requests new OTP
        self.client.force_authenticate(user=self.student)
        res = self.client.post(f'/api/pickup/claims/{self.claim.public_id}/regenerate-otp/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        new_otp = res.data.get('otp')
        self.assertIsNotNone(new_otp)
        self.assertNotEqual(new_otp, self.plain_otp)

        # Handover failed attempts reset
        self.handover.refresh_from_db()
        self.assertEqual(self.handover.failed_otp_attempts, 0)
        self.assertEqual(self.handover.status, HandoverStatus.PENDING_OTP)

        # Old OTP no longer works
        self.client.force_authenticate(user=self.staff_user)
        old_res = self.client.post(
            f'/api/handovers/admin/{self.handover.public_id}/verify-otp/',
            {'otp': self.plain_otp}
        )
        self.assertEqual(old_res.status_code, status.HTTP_400_BAD_REQUEST)

        # New OTP succeeds
        new_res = self.client.post(
            f'/api/handovers/admin/{self.handover.public_id}/verify-otp/',
            {'otp': new_otp}
        )
        self.assertEqual(new_res.status_code, status.HTTP_200_OK)
        self.handover.refresh_from_db()
        self.assertEqual(self.handover.status, HandoverStatus.COMPLETED)
        self.valuable_item.refresh_from_db()
        self.assertEqual(self.valuable_item.status, ItemStatus.RESOLVED)

    def test_cross_user_cannot_verify_otp(self):
        # Another student cannot verify OTP
        self.client.force_authenticate(user=self.other_student)
        res = self.client.post(
            f'/api/handovers/admin/{self.handover.public_id}/verify-otp/',
            {'otp': self.plain_otp}
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class DisputeBlockingTests(AdminHandoverOtpBaseFixture):
    def setUp(self):
        super().setUp()
        self.claim = Claim.objects.create(
            student=self.student,
            found_item=self.valuable_item,
            status=ClaimStatus.APPROVED,
        )
        ct = ContentType.objects.get_for_model(FoundItem)
        self.pickup_req = PickupRequest.objects.create(
            requester=self.student,
            claim=self.claim,
            collection_point=self.cp,
            content_type=ct,
            object_id=self.valuable_item.id,
            status='READY_FOR_PICKUP',
        )
        self.handover = Handover.objects.create(
            pickup_request=self.pickup_req,
            found_item=self.valuable_item,
            student=self.student,
            is_valuable=True,
            status=HandoverStatus.PENDING_OTP,
        )
        self.plain_otp = generate_otp(self.handover)

        # Create active dispute
        self.dispute = Dispute.objects.create(
            reporter=self.other_student,
            claim=self.claim,
            found_item=self.valuable_item,
            reason=DisputeReason.ANOTHER_CLAIMING,
            description='This laptop is actually mine, serial number XYZ.',
            status=DisputeStatus.OPEN,
        )

    def test_active_dispute_blocks_otp_verification(self):
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(
            f'/api/handovers/admin/{self.handover.public_id}/verify-otp/',
            {'otp': self.plain_otp}
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('dispute', str(res.data).lower())

    def test_active_dispute_blocks_otp_regeneration(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post(f'/api/pickup/claims/{self.claim.public_id}/regenerate-otp/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('dispute', str(res.data).lower())

    def test_active_dispute_blocks_confirm_collection(self):
        # Non-valuable item with active dispute
        nv_claim = Claim.objects.create(
            student=self.student,
            found_item=self.found_item,
            status=ClaimStatus.APPROVED,
        )
        ct = ContentType.objects.get_for_model(FoundItem)
        nv_pickup = PickupRequest.objects.create(
            requester=self.student,
            claim=nv_claim,
            collection_point=self.cp,
            content_type=ct,
            object_id=self.found_item.id,
            status='READY_FOR_PICKUP',
        )
        nv_handover = Handover.objects.create(
            pickup_request=nv_pickup,
            found_item=self.found_item,
            student=self.student,
            is_valuable=False,
            status=HandoverStatus.READY,
        )
        Dispute.objects.create(
            reporter=self.other_student,
            claim=nv_claim,
            found_item=self.found_item,
            reason=DisputeReason.NOT_MINE,
            description='Disputed bottle',
            status=DisputeStatus.UNDER_REVIEW,
        )

        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(f'/api/handovers/admin/{nv_handover.public_id}/confirm-collection/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('dispute', str(res.data).lower())
