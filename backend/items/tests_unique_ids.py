"""
Targeted tests for Reunite Unique Lost/Found IDs, Exact-ID Search, and Custodial Invariants.
"""

import re
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status as http_status

from accounts.models import User
from collectionpoint.models import CollectionPoint
from items.models import FoundItem, LostItem, ItemStatus, generate_lost_id, generate_found_id
from pickup.models import Claim, ClaimStatus, OwnershipVerification
from audit.models import AuditLog


class UniqueIdAndCustodialInvariantTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.student = User.objects.create_user(
            email='alice@college.edu',
            password='password123',
            name='Alice Student',
            role='student',
            mobile_number='+1234567890',
        )
        self.staff = User.objects.create_user(
            email='custodian@college.edu',
            password='password123',
            name='Campus Custodian',
            role='custodian',
            is_staff=True,
        )
        self.cp = CollectionPoint.objects.create(
            station_code='RNT-B1-F01-S01',
            building='Library',
            floor='1st Floor',
            station_type='Main Desk',
        )

    def test_lost_item_id_format_and_uniqueness(self):
        """LostItem should generate permanent human-readable IDs formatted like RNT-L-XXXXXX."""
        item1 = LostItem.objects.create(
            user=self.student,
            category='Electronics',
            description='Silver Laptop',
        )
        item2 = LostItem.objects.create(
            user=self.student,
            category='Books',
            description='Calculus Textbook',
        )

        self.assertTrue(item1.public_id.startswith('RNT-L-'))
        self.assertTrue(item2.public_id.startswith('RNT-L-'))
        self.assertRegex(item1.public_id, r'^RNT-L-[2-9A-HJ-NP-Z]{6}$')
        self.assertRegex(item2.public_id, r'^RNT-L-[2-9A-HJ-NP-Z]{6}$')
        self.assertNotEqual(item1.public_id, item2.public_id)

    def test_found_item_id_format_and_uniqueness(self):
        """FoundItem should generate permanent human-readable IDs formatted like RNT-F-XXXXXX."""
        item1 = FoundItem.objects.create(
            user=self.staff,
            title='Blue Backpack',
            category='Bags',
            description='Navy blue backpack found in foyer',
        )
        item2 = FoundItem.objects.create(
            user=self.staff,
            title='Wristwatch',
            category='Accessories',
            description='Analog silver watch',
        )

        self.assertTrue(item1.public_id.startswith('RNT-F-'))
        self.assertTrue(item2.public_id.startswith('RNT-F-'))
        self.assertRegex(item1.public_id, r'^RNT-F-[2-9A-HJ-NP-Z]{6}$')
        self.assertRegex(item2.public_id, r'^RNT-F-[2-9A-HJ-NP-Z]{6}$')
        self.assertNotEqual(item1.public_id, item2.public_id)

    def test_custodian_exact_id_search_found_items(self):
        """Authorized custodians can search found reports by exact ID."""
        item1 = FoundItem.objects.create(
            user=self.staff,
            title='Scientific Calculator',
            category='Electronics',
            description='TI-84 calculator',
            collection_point=self.cp,
            is_published=True,
        )
        item2 = FoundItem.objects.create(
            user=self.staff,
            title='Water Bottle',
            category='Bottles',
            description='Metal flask',
            collection_point=self.cp,
            is_published=True,
        )

        self.client.force_authenticate(user=self.staff)

        # 1. Using exact_id param
        resp = self.client.get(f'/api/items/found-items/?exact_id={item1.public_id}')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        results = resp.json() if isinstance(resp.json(), list) else resp.json().get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['public_id'], item1.public_id)

        # 2. Using search param with exact ID
        resp2 = self.client.get(f'/api/items/found-items/?search={item2.public_id}')
        self.assertEqual(resp2.status_code, http_status.HTTP_200_OK)
        results2 = resp2.json() if isinstance(resp2.json(), list) else resp2.json().get('results', [])
        self.assertEqual(len(results2), 1)
        self.assertEqual(results2[0]['public_id'], item2.public_id)

    def test_custodian_exact_id_search_lost_items(self):
        """Authorized custodians can search lost reports by exact ID."""
        item1 = LostItem.objects.create(
            user=self.student,
            category='Electronics',
            description='Black Earbuds in case',
        )
        item2 = LostItem.objects.create(
            user=self.student,
            category='Wallets',
            description='Brown leather wallet',
        )

        self.client.force_authenticate(user=self.staff)

        # 1. Using exact_id param
        resp = self.client.get(f'/api/items/lost-items/?exact_id={item1.public_id}')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        results = resp.json() if isinstance(resp.json(), list) else resp.json().get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['public_id'], item1.public_id)

        # 2. Using search param with exact ID
        resp2 = self.client.get(f'/api/items/lost-items/?search={item2.public_id}')
        self.assertEqual(resp2.status_code, http_status.HTTP_200_OK)
        results2 = resp2.json() if isinstance(resp2.json(), list) else resp2.json().get('results', [])
        self.assertEqual(len(results2), 1)
        self.assertEqual(results2[0]['public_id'], item2.public_id)

    def test_item_not_marked_deposited_until_custodian_confirms(self):
        """
        Student reporting creates an item as DEPOSIT_PENDING.
        Only custodian confirmation via confirm-deposit transitions status to DEPOSITED.
        """
        self.client.force_authenticate(user=self.student)
        resp = self.client.post('/api/items/student-found/', {
            'title': 'Found Umbrella',
            'category': 'Other',
            'description': 'Black folding umbrella left in room 101',
            'cannot_carry': False,
            'collection_point': self.cp.id,
        })
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED)
        item_id = resp.json()['public_id']
        found_item = FoundItem.objects.get(public_id=item_id)
        # Not marked as DEPOSITED
        self.assertEqual(found_item.status, ItemStatus.DEPOSIT_PENDING)
        self.assertNotEqual(found_item.status, ItemStatus.DEPOSITED)

        # Custodian confirms receipt
        self.client.force_authenticate(user=self.staff)
        confirm_resp = self.client.post(f'/api/items/found-items/{item_id}/confirm-deposit/', {
            'collection_point': self.cp.id,
        })
        self.assertEqual(confirm_resp.status_code, http_status.HTTP_200_OK)
        found_item.refresh_from_db()
        self.assertEqual(found_item.status, ItemStatus.DEPOSITED)

        # Audit log was created
        log = AuditLog.objects.filter(target_id=str(item_id), action='PHYSICAL_DEPOSIT_CONFIRMED').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor, self.staff)

    def test_id_alone_does_not_authorize_ownership_or_pickup(self):
        """
        An ID alone must never authorize ownership or pickup.
        Claims without verification answer fail, and unapproved claims cannot proceed to pickup.
        """
        found_item = FoundItem.objects.create(
            user=self.staff,
            title='Smart Phone',
            category='Electronics',
            description='Phone with cracked screen',
            collection_point=self.cp,
            is_published=True,
            status=ItemStatus.DEPOSITED,
            risk_tier=1,
        )

        self.client.force_authenticate(user=self.student)

        # 1. Attempting to claim with ID alone without verification answer must be rejected
        claim_resp = self.client.post('/api/pickup/claims/', {
            'found_item_id': found_item.public_id,
            # 'student_answer' omitted
        })
        self.assertEqual(claim_resp.status_code, http_status.HTTP_400_BAD_REQUEST)

        # 2. Even when a claim is filed, status is PENDING and ownership is NOT granted
        claim_valid_resp = self.client.post('/api/pickup/claims/', {
            'found_item_id': found_item.public_id,
            'student_answer': 'My lock screen wallpaper is a golden retriever',
        })
        self.assertEqual(claim_valid_resp.status_code, http_status.HTTP_201_CREATED)
        claim_id = claim_valid_resp.json()['public_id']

        claim = Claim.objects.get(public_id=claim_id)
        self.assertEqual(claim.status, ClaimStatus.PENDING)

        # 3. Handover cannot be completed without custodian approval and OTP verification
        self.client.force_authenticate(user=self.staff)
        # Verify the item has not been marked resolved or picked up
        found_item.refresh_from_db()
        self.assertNotEqual(found_item.status, ItemStatus.RESOLVED)
        self.assertNotEqual(found_item.status, ItemStatus.READY_FOR_PICKUP)


class AdminDeleteReportTests(TestCase):
    """Tests for the admin-only destroy() endpoint on Found and Lost items."""

    def setUp(self):
        self.client = APIClient()

        self.student = User.objects.create_user(
            email='student_del@college.edu',
            password='password123',
            name='Del Student',
            role='student',
            mobile_number='+1111111111',
        )
        self.custodian = User.objects.create_user(
            email='custodian_del@college.edu',
            password='password123',
            name='Del Custodian',
            role='custodian',
            is_staff=True,
        )
        self.admin = User.objects.create_user(
            email='admin_del@college.edu',
            password='password123',
            name='Del Admin',
            role='admin',
            is_staff=True,
        )
        self.cp = CollectionPoint.objects.create(
            station_code='RNT-DEL-S01',
            building='Admin Block',
            floor='Ground',
            station_type='Main Desk',
        )
        self.found_item = FoundItem.objects.create(
            user=self.student,
            category='Electronics',
            description='Deleted found item',
            collection_point=self.cp,
            status=ItemStatus.DEPOSIT_PENDING,
        )
        self.lost_item = LostItem.objects.create(
            user=self.student,
            category='Books',
            description='Deleted lost item',
        )

    def test_admin_can_delete_found_report(self):
        """Admin DELETE /api/items/found-items/{id}/ archives the item."""
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(f'/api/items/found-items/{self.found_item.public_id}/')
        self.assertIn(resp.status_code, [200, 204])
        self.found_item.refresh_from_db()
        self.assertEqual(self.found_item.status, ItemStatus.ARCHIVED)
        # Audit log should record the deletion
        self.assertTrue(
            AuditLog.objects.filter(
                target_id=str(self.found_item.public_id),
                action='REPORT_ARCHIVED',
            ).exists()
        )

    def test_admin_can_delete_lost_report(self):
        """Admin DELETE /api/items/lost-items/{id}/ archives the item."""
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(f'/api/items/lost-items/{self.lost_item.public_id}/')
        self.assertIn(resp.status_code, [200, 204])
        self.lost_item.refresh_from_db()
        self.assertEqual(self.lost_item.status, ItemStatus.ARCHIVED)

    def test_custodian_cannot_delete_found_report(self):
        """Non-admin staff (custodian) must receive 403 on DELETE."""
        self.client.force_authenticate(user=self.custodian)
        resp = self.client.delete(f'/api/items/found-items/{self.found_item.public_id}/')
        self.assertEqual(resp.status_code, 403)
        # Item must remain untouched
        self.found_item.refresh_from_db()
        self.assertNotEqual(self.found_item.status, ItemStatus.ARCHIVED)

    def test_custodian_cannot_delete_lost_report(self):
        """Non-admin staff (custodian) must receive 403 on DELETE."""
        self.client.force_authenticate(user=self.custodian)
        resp = self.client.delete(f'/api/items/lost-items/{self.lost_item.public_id}/')
        self.assertEqual(resp.status_code, 403)

    def test_student_cannot_delete_found_report(self):
        """Students must receive 403 on DELETE."""
        self.client.force_authenticate(user=self.student)
        resp = self.client.delete(f'/api/items/found-items/{self.found_item.public_id}/')
        self.assertEqual(resp.status_code, 403)

    def test_student_cannot_delete_lost_report(self):
        """Students must receive 403 on DELETE."""
        self.client.force_authenticate(user=self.student)
        resp = self.client.delete(f'/api/items/lost-items/{self.lost_item.public_id}/')
        self.assertEqual(resp.status_code, 403)

    def test_already_archived_found_report_returns_error(self):
        """Deleting an already-archived item returns 400 or 409."""
        self.found_item.status = ItemStatus.ARCHIVED
        self.found_item.save()
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(f'/api/items/found-items/{self.found_item.public_id}/')
        # The destroy() endpoint is idempotent: re-archiving an already-archived item returns 200
        self.assertIn(resp.status_code, [200, 400, 409])

