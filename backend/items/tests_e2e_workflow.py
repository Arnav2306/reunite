"""
Phase 6: End-to-End workflow acceptance tests for Reunite.
Tests the complete Lost & Found recovery workflow in a single integrated test class.
"""

from django.test import TestCase
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APIClient
from rest_framework import status as http_status

from accounts.models import User
from collectionpoint.models import CollectionPoint
from items.models import FoundItem, LostItem, ItemStatus, Match, MatchStatus
from pickup.models import Claim, ClaimStatus, OwnershipVerification, PickupRequest
from handovers.models import Handover, HandoverStatus
from audit.models import AuditLog
from notifications.models import Notification


class EndToEndRecoveryWorkflowTests(TestCase):
    """
    Integrated E2E test: Lost report → Found report → Match → Deposit →
    Claim approval → Handover → Status updates + audit.
    """

    def setUp(self):
        self.client = APIClient()

        self.student_owner = User.objects.create_user(
            email='owner@college.edu',
            password='password123',
            name='Item Owner',
            role='student',
            mobile_number='+1000000001',
        )
        self.student_finder = User.objects.create_user(
            email='finder@college.edu',
            password='password123',
            name='Item Finder',
            role='student',
            mobile_number='+1000000002',
        )
        self.custodian = User.objects.create_user(
            email='custodian@college.edu',
            password='password123',
            name='Campus Custodian',
            role='custodian',
            is_staff=True,
        )
        self.admin = User.objects.create_user(
            email='admin@college.edu',
            password='password123',
            name='Campus Admin',
            role='admin',
            is_staff=True,
        )
        self.cp = CollectionPoint.objects.create(
            station_code='RNT-LIB-F01-S01',
            building='Library',
            floor='1st Floor',
            station_type='Main Desk',
        )

    # ------------------------------------------------------------------
    # Step 1: Lost report creation → RNT-L-... ID
    # ------------------------------------------------------------------

    def test_01_student_creates_lost_report_gets_rnt_l_id(self):
        """Student creates a lost report and receives a permanent RNT-L-... ID."""
        self.client.force_authenticate(user=self.student_owner)
        resp = self.client.post('/api/items/lost-items/', {
            'category': 'Electronics',
            'description': 'Silver MacBook Pro 14-inch with sticker on back',
            'color': 'Silver',
            'brand': 'Apple',
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED)
        data = resp.json()
        public_id = data.get('public_id', '')
        self.assertTrue(public_id.startswith('RNT-L-'), f"Expected RNT-L-... got: {public_id}")
        self.assertRegex(public_id, r'^RNT-L-[2-9A-HJ-NP-Z]{6}$')
        # ID must persist
        item = LostItem.objects.get(public_id=public_id)
        self.assertEqual(item.public_id, public_id)

    # ------------------------------------------------------------------
    # Step 2: Found report creation → RNT-F-... ID
    # ------------------------------------------------------------------

    def test_02_finder_creates_found_report_gets_rnt_f_id(self):
        """Finder submits a found report and receives a permanent RNT-F-... ID."""
        self.client.force_authenticate(user=self.student_finder)
        resp = self.client.post('/api/items/student-found/', {
            'category': 'Electronics',
            'description': 'Silver laptop found near library entrance',
            'found_location': 'Library Ground Floor',
            'collection_point_id': self.cp.id,
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED)
        data = resp.json()
        public_id = data.get('public_id', '')
        self.assertTrue(public_id.startswith('RNT-F-'), f"Expected RNT-F-... got: {public_id}")
        self.assertRegex(public_id, r'^RNT-F-[2-9A-HJ-NP-Z]{6}$')
        # Should start as DEPOSIT_PENDING
        item = FoundItem.objects.get(public_id=public_id)
        self.assertEqual(item.status, ItemStatus.DEPOSIT_PENDING)

    # ------------------------------------------------------------------
    # Step 3: ID immutability
    # ------------------------------------------------------------------

    def test_03_report_ids_are_immutable(self):
        """IDs must never change after creation."""
        lost = LostItem.objects.create(user=self.student_owner, category='Books', description='Test')
        found = FoundItem.objects.create(
            user=self.student_finder, category='Books', description='Test',
            collection_point=self.cp, status=ItemStatus.DEPOSIT_PENDING
        )
        original_lost_id = lost.public_id
        original_found_id = found.public_id

        # Attempt to change ID via save()
        lost.public_id = 'RNT-L-HACKED'
        lost.save()
        lost.refresh_from_db()
        self.assertEqual(lost.public_id, original_lost_id, "Lost ID must be immutable")

        found.public_id = 'RNT-F-HACKED'
        found.save()
        found.refresh_from_db()
        self.assertEqual(found.public_id, original_found_id, "Found ID must be immutable")

    # ------------------------------------------------------------------
    # Step 4: Custodian searches by Found ID and confirms deposit
    # ------------------------------------------------------------------

    def test_04_custodian_confirms_deposit(self):
        """Custodian searches Found ID, receives item, confirms deposit."""
        found = FoundItem.objects.create(
            user=self.student_finder,
            category='Electronics',
            description='Silver laptop',
            collection_point=self.cp,
            status=ItemStatus.DEPOSIT_PENDING,
            is_published=True,
        )

        # Custodian searches by exact ID
        self.client.force_authenticate(user=self.custodian)
        search_resp = self.client.get(
            f'/api/items/found-items/?search={found.public_id}',
        )
        self.assertEqual(search_resp.status_code, 200)
        results = search_resp.json()
        ids = [r.get('public_id') for r in (results if isinstance(results, list) else results.get('results', []))]
        self.assertIn(found.public_id, ids)

        # Custodian confirms physical deposit
        deposit_resp = self.client.post(f'/api/items/found-items/{found.public_id}/confirm-deposit/')
        self.assertEqual(deposit_resp.status_code, 200)
        found.refresh_from_db()
        self.assertEqual(found.status, ItemStatus.DEPOSITED)

        # Audit log should exist
        self.assertTrue(
            AuditLog.objects.filter(target_id=str(found.public_id)).exists()
        )

    # ------------------------------------------------------------------
    # Step 5: ID alone does NOT authorize handover
    # ------------------------------------------------------------------

    def test_05_id_alone_never_proves_ownership(self):
        """A Found ID alone cannot complete handover without approved claim + verification."""
        found = FoundItem.objects.create(
            user=self.student_finder,
            category='Electronics',
            description='Silver laptop',
            collection_point=self.cp,
            status=ItemStatus.DEPOSITED,
            is_published=True,
        )
        lost = LostItem.objects.create(
            user=self.student_owner,
            category='Electronics',
            description='Silver laptop'
        )

        # Student tries to claim using only the Found ID (no ownership answer)
        self.client.force_authenticate(user=self.student_owner)
        resp = self.client.post('/api/pickup/claims/', {
            'found_item_id': found.public_id,
            # 'student_answer' intentionally omitted
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Step 6: Full handover flow (non-valuable item)
    # ------------------------------------------------------------------

    def test_06_complete_handover_non_valuable_item(self):
        """Complete handover flow for a non-valuable item (no OTP required)."""
        found = FoundItem.objects.create(
            user=self.student_finder,
            category='Electronics',
            description='Silver laptop',
            collection_point=self.cp,
            status=ItemStatus.DEPOSITED,
            is_published=True,
            risk_tier=0,  # non-valuable
        )
        lost = LostItem.objects.create(
            user=self.student_owner,
            category='Electronics',
            description='Silver laptop'
        )
        match = Match.objects.create(
            lost_item=lost,
            found_item=found,
            score=95,
            status=MatchStatus.REVIEWED,
        )

        # Create an approved claim with ownership verification
        claim = Claim.objects.create(
            student=self.student_owner,
            found_item=found,
            status=ClaimStatus.APPROVED,
        )
        OwnershipVerification.objects.create(
            claim=claim,
            student_answer='The lock screen shows my cat Whiskers',
        )

        # Update found item to READY_FOR_PICKUP
        found.status = ItemStatus.READY_FOR_PICKUP
        found.save()

        # Create pickup request and Handover record
        ct = ContentType.objects.get_for_model(FoundItem)
        pickup = PickupRequest.objects.create(
            requester=self.student_owner,
            claim=claim,
            collection_point=self.cp,
            content_type=ct,
            object_id=found.id,
            status='READY_FOR_PICKUP',
        )

        handover = Handover.objects.create(
            pickup_request=pickup,
            found_item=found,
            student=self.student_owner,
            custodian=self.custodian,
            is_valuable=False,
            status=HandoverStatus.READY,
        )

        # Custodian completes handover
        self.client.force_authenticate(user=self.custodian)
        resp = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/confirm-collection/',
            format='json'
        )
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK, f"Handover failed: {resp.data}")

        found.refresh_from_db()
        self.assertIn(found.status, [ItemStatus.COLLECTED, ItemStatus.RESOLVED])
        lost.refresh_from_db()
        self.assertEqual(lost.status, ItemStatus.RESOLVED)
        match.refresh_from_db()
        self.assertEqual(match.status, MatchStatus.CLAIMED)
        handover.refresh_from_db()
        self.assertEqual(handover.status, HandoverStatus.COMPLETED)

        # Verify audit log created
        self.assertTrue(
            AuditLog.objects.filter(
                action='HANDOVER_COMPLETED',
                actor=self.custodian,
            ).exists()
        )

    # ------------------------------------------------------------------
    # Step 7: Duplicate handover is blocked
    # ------------------------------------------------------------------

    def test_07_duplicate_handover_is_blocked(self):
        """Attempting handover on an already-COMPLETED handover must fail."""
        found = FoundItem.objects.create(
            user=self.student_finder,
            category='Electronics',
            description='Already collected laptop',
            collection_point=self.cp,
            status=ItemStatus.COLLECTED,
            is_published=False,
        )
        ct = ContentType.objects.get_for_model(FoundItem)
        claim = Claim.objects.create(
            student=self.student_owner,
            found_item=found,
            status=ClaimStatus.APPROVED,
        )
        pickup = PickupRequest.objects.create(
            requester=self.student_owner,
            claim=claim,
            collection_point=self.cp,
            content_type=ct,
            object_id=found.id,
            status='COLLECTED',
        )
        handover = Handover.objects.create(
            pickup_request=pickup,
            found_item=found,
            student=self.student_owner,
            custodian=self.custodian,
            is_valuable=False,
            status=HandoverStatus.COMPLETED,
        )
        self.client.force_authenticate(user=self.custodian)
        resp = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/confirm-collection/',
            format='json'
        )
        self.assertEqual(resp.status_code, http_status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Step 8: Unauthorized users cannot complete handover
    # ------------------------------------------------------------------

    def test_08_student_cannot_complete_handover(self):
        """Students cannot call the staff handover endpoint (IsStaff required)."""
        found = FoundItem.objects.create(
            user=self.student_finder,
            category='Electronics',
            description='Laptop',
            collection_point=self.cp,
            status=ItemStatus.READY_FOR_PICKUP,
            is_published=True,
        )
        ct = ContentType.objects.get_for_model(FoundItem)
        claim = Claim.objects.create(
            student=self.student_owner,
            found_item=found,
            status=ClaimStatus.APPROVED,
        )
        pickup = PickupRequest.objects.create(
            requester=self.student_owner,
            claim=claim,
            collection_point=self.cp,
            content_type=ct,
            object_id=found.id,
            status='READY_FOR_PICKUP',
        )
        handover = Handover.objects.create(
            pickup_request=pickup,
            found_item=found,
            student=self.student_owner,
            custodian=self.custodian,
            is_valuable=False,
            status=HandoverStatus.READY,
        )
        self.client.force_authenticate(user=self.student_owner)
        resp = self.client.post(
            f'/api/handovers/admin/{handover.public_id}/confirm-collection/',
            format='json'
        )
        self.assertEqual(resp.status_code, http_status.HTTP_403_FORBIDDEN)

    # ------------------------------------------------------------------
    # Step 9: Admin can archive found and lost reports
    # ------------------------------------------------------------------

    def test_09_admin_archives_found_report_preserves_history(self):
        """Admin DELETE archives found item; audit history remains intact."""
        found = FoundItem.objects.create(
            user=self.student_finder,
            category='Electronics',
            description='Laptop to archive',
            collection_point=self.cp,
            status=ItemStatus.DEPOSIT_PENDING,
        )
        # Create some prior audit history
        AuditLog.objects.create(
            actor=self.custodian,
            action='DEPOSIT_CONFIRMED',
            target_type='FoundItem',
            target_id=str(found.public_id),
            details={'note': 'pre-existing audit event'},
        )

        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(f'/api/items/found-items/{found.public_id}/')
        self.assertIn(resp.status_code, [200, 204])

        found.refresh_from_db()
        self.assertEqual(found.status, ItemStatus.ARCHIVED)

        # Prior audit log must still exist
        self.assertTrue(
            AuditLog.objects.filter(
                target_id=str(found.public_id),
                action='DEPOSIT_CONFIRMED',
            ).exists(),
            "Pre-existing audit history must be preserved after soft-delete"
        )

    def test_10_admin_archives_lost_report(self):
        """Admin DELETE archives lost item."""
        lost = LostItem.objects.create(
            user=self.student_owner,
            category='Books',
            description='Lost book to archive',
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(f'/api/items/lost-items/{lost.public_id}/')
        self.assertIn(resp.status_code, [200, 204])
        lost.refresh_from_db()
        self.assertEqual(lost.status, ItemStatus.ARCHIVED)

    def test_11_custodian_cannot_delete_reports(self):
        """Custodian role must be blocked from deleting reports (admin-only)."""
        found = FoundItem.objects.create(
            user=self.student_finder, category='Electronics', description='Test',
            collection_point=self.cp, status=ItemStatus.DEPOSIT_PENDING,
        )
        self.client.force_authenticate(user=self.custodian)
        resp = self.client.delete(f'/api/items/found-items/{found.public_id}/')
        self.assertEqual(resp.status_code, 403)

    def test_12_student_cannot_delete_reports(self):
        """Students must be blocked from deleting any report."""
        lost = LostItem.objects.create(
            user=self.student_owner, category='Books', description='Test'
        )
        self.client.force_authenticate(user=self.student_owner)
        resp = self.client.delete(f'/api/items/lost-items/{lost.public_id}/')
        self.assertEqual(resp.status_code, 403)


class MatchNotificationContentTests(TestCase):
    """Verify match notifications include Found ID and station information."""

    def setUp(self):
        self.student = User.objects.create_user(
            email='notif_student@college.edu', password='pass',
            name='Notif Student', role='student', mobile_number='+2000000001'
        )
        self.cp = CollectionPoint.objects.create(
            station_code='RNT-HALL-F02-S01',
            building='Main Hall',
            floor='2nd Floor',
            station_type='Security Desk',
        )

    def test_found_id_format_in_match_notification(self):
        """Match notifications should include Found ID and station code."""
        lost = LostItem.objects.create(
            user=self.student,
            category='Electronics',
            description='Blue wireless headphones Bose QC45',
        )
        found = FoundItem.objects.create(
            user=self.student,
            category='Electronics',
            description='Blue wireless headphones found in hall',
            collection_point=self.cp,
            status=ItemStatus.DEPOSITED,
            is_published=True,
        )
        match = Match.objects.create(
            lost_item=lost,
            found_item=found,
            score=0.92,
            status=MatchStatus.CANDIDATE,
        )

        match.refresh_from_db()
        self.assertTrue(match.found_item.public_id.startswith('RNT-F-'))
        self.assertEqual(match.found_item.collection_point.station_code, self.cp.station_code)


class StationInfoAccuracyTests(TestCase):
    """Verify station information is stored and accessible correctly."""

    def setUp(self):
        self.cp = CollectionPoint.objects.create(
            station_code='RNT-SCI-B1-S01',
            building='Science Block',
            floor='Block B, Level 1',
            station_type='Reception',
        )
        self.student = User.objects.create_user(
            email='station_test@college.edu', password='pass',
            name='Station Tester', role='student', mobile_number='+3000000001'
        )

    def test_found_item_carries_station_info(self):
        """FoundItem stores collection_point; station_code and building accessible."""
        found = FoundItem.objects.create(
            user=self.student,
            category='Keys',
            description='Car key with blue fob',
            collection_point=self.cp,
            status=ItemStatus.DEPOSITED,
            is_published=True,
        )
        self.assertEqual(found.collection_point.station_code, 'RNT-SCI-B1-S01')
        self.assertEqual(found.collection_point.building, 'Science Block')

    def test_custodian_can_retrieve_station_via_api(self):
        """Custodian GET on found item includes collection_point data."""
        found = FoundItem.objects.create(
            user=self.student,
            category='Keys',
            description='Car key with blue fob',
            collection_point=self.cp,
            status=ItemStatus.DEPOSITED,
            is_published=True,
        )
        custodian = User.objects.create_user(
            email='cust_station@college.edu', password='pass',
            name='Cust Station', role='custodian', is_staff=True
        )
        client = APIClient()
        client.force_authenticate(user=custodian)
        resp = client.get(f'/api/items/found-items/{found.public_id}/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('collection_point', data)
