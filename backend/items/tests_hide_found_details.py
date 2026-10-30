"""
Phase 7: Targeted tests proving students cannot retrieve photos, detailed descriptions,
or identifying attributes of found items, while authorized staff retain full access.
"""

from unittest.mock import patch
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APIClient
from rest_framework import status as http_status

from accounts.models import User
from collectionpoint.models import CollectionPoint
from items.models import FoundItem, LostItem, ItemStatus, ItemImage, Match, MatchStatus
from notifications.models import Notification


class HideFoundDetailsSecurityTests(TestCase):
    """
    Security verification: Students can browse available items and matches,
    but backend strictly hides photos, thumbnails, detailed descriptions,
    brand, and specific locations from student payloads.
    Staff retain full authorized access.
    """

    def setUp(self):
        self.client = APIClient()

        self.student = User.objects.create_user(
            email='student_sec@college.edu',
            password='password123',
            name='Student Jane',
            role='student',
            mobile_number='+1999999999',
        )
        self.custodian = User.objects.create_user(
            email='custodian_sec@college.edu',
            password='password123',
            name='Campus Custodian',
            role='custodian',
            is_staff=True,
        )
        self.admin = User.objects.create_user(
            email='admin_sec@college.edu',
            password='password123',
            name='Campus Admin',
            role='admin',
            is_staff=True,
        )
        self.cp = CollectionPoint.objects.create(
            station_code='RNT-SEC-F01-S01',
            building='Security Center',
            floor='1st Floor',
            station_type='Main Desk',
        )

        # Create published found item with detailed/sensitive information
        self.secret_description = "Special Edition Silver MacBook Pro 14 M2 with red Apple logo sticker and scratch on top left corner"
        self.secret_title = "Apple MacBook Pro 14 Silver M2"
        self.secret_location = "Room 304, behind podium desk near electrical socket"

        self.found_item = FoundItem.objects.create(
            user=self.custodian,
            title=self.secret_title,
            category='Electronics',
            description=self.secret_description,
            found_location=self.secret_location,
            collection_point=self.cp,
            status=ItemStatus.DEPOSITED,
            is_published=True,
            risk_tier=1,
            cannot_carry_details='Heavy equipment in metal box',
        )

        # Attach image to found item with cloudinary upload patched
        ct = ContentType.objects.get_for_model(FoundItem)
        fake_image = SimpleUploadedFile("found_laptop.jpg", b"fake-image-bytes-content", content_type="image/jpeg")

        with patch('cloudinary.uploader.upload', return_value={
            'secure_url': 'https://res.cloudinary.com/demo/image/upload/found_laptop.jpg',
            'public_id': 'found_laptop',
            'url': 'http://res.cloudinary.com/demo/image/upload/found_laptop.jpg',
        }):
            self.item_image = ItemImage.objects.create(
                content_type=ct,
                object_id=self.found_item.id,
                image=fake_image,
            )

    def test_student_cannot_see_photos_or_thumbnails_in_available_items(self):
        """Students browsing available items receive empty images array (no URLs or photos)."""
        self.client.force_authenticate(user=self.student)
        resp = self.client.get('/api/items/available-items/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)

        data = resp.json()
        results = data if isinstance(data, list) else data.get('results', [])
        self.assertTrue(len(results) > 0)

        target = next((item for item in results if item.get('public_id') == self.found_item.public_id), None)
        self.assertIsNotNone(target)

        # Images array must be strictly empty for students
        self.assertEqual(target.get('images'), [])
        # Raw response payload must not contain the image file name or media path
        resp_content = resp.content.decode('utf-8')
        self.assertNotIn("found_laptop.jpg", resp_content)
        self.assertNotIn("fake-image-bytes-content", resp_content)

    def test_student_cannot_see_detailed_description_or_identifying_title(self):
        """Students browsing available items do not receive the detailed description or identifying title."""
        self.client.force_authenticate(user=self.student)
        resp = self.client.get('/api/items/available-items/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)

        data = resp.json()
        results = data if isinstance(data, list) else data.get('results', [])
        target = next((item for item in results if item.get('public_id') == self.found_item.public_id), None)
        self.assertIsNotNone(target)

        # Description and exact location are stripped
        self.assertIsNone(target.get('description'))
        self.assertIsNone(target.get('found_location'))
        self.assertIsNone(target.get('cannot_carry_details'))

        # Title is replaced with broad category
        self.assertEqual(target.get('title'), 'Electronics')

        # Raw response payload check
        resp_content = resp.content.decode('utf-8')
        self.assertNotIn(self.secret_description, resp_content)
        self.assertNotIn("Room 304, behind podium", resp_content)
        self.assertNotIn("MacBook Pro 14", resp_content)

    def test_student_sees_safe_public_fields(self):
        """Students see safe non-identifying attributes: broad category, Found ID, date, and station."""
        self.client.force_authenticate(user=self.student)
        resp = self.client.get('/api/items/available-items/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)

        data = resp.json()
        results = data if isinstance(data, list) else data.get('results', [])
        target = next((item for item in results if item.get('public_id') == self.found_item.public_id), None)
        self.assertIsNotNone(target)

        self.assertEqual(target.get('public_id'), self.found_item.public_id)
        self.assertEqual(target.get('category'), 'Electronics')
        self.assertEqual(target.get('availability_status'), 'Available for verification')
        self.assertIn('collection_location', target)
        self.assertEqual(target['collection_location']['station_code'], 'RNT-SEC-F01-S01')
        self.assertEqual(target['collection_location']['building'], 'Security Center')

    def test_staff_can_view_complete_details_and_photos(self):
        """Authorized custodians and admins retain full access to complete details and photos."""
        self.client.force_authenticate(user=self.custodian)
        resp = self.client.get(f'/api/items/found-items/{self.found_item.public_id}/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)

        data = resp.json()
        self.assertEqual(data.get('title'), self.secret_title)
        self.assertEqual(data.get('description'), self.secret_description)
        self.assertEqual(data.get('found_location'), self.secret_location)
        self.assertTrue(len(data.get('images', [])) > 0)

    def test_student_cannot_probe_descriptions_via_search(self):
        """Students cannot search/oracle-probe hidden descriptions or secret keywords."""
        self.client.force_authenticate(user=self.student)

        # Searching for a word only in the secret description must return 0 results for students
        probe_resp = self.client.get('/api/items/available-items/?search=scratch')
        self.assertEqual(probe_resp.status_code, http_status.HTTP_200_OK)
        results = probe_resp.json()
        items = results if isinstance(results, list) else results.get('results', [])
        self.assertEqual(len(items), 0, "Student should not be able to find items by hidden description words")

        # Searching by category works
        cat_resp = self.client.get('/api/items/available-items/?search=Electronics')
        self.assertEqual(cat_resp.status_code, http_status.HTTP_200_OK)
        cat_results = cat_resp.json()
        cat_items = cat_results if isinstance(cat_results, list) else cat_results.get('results', [])
        self.assertTrue(len(cat_items) >= 1)

        # Searching by exact Found ID works
        id_resp = self.client.get(f'/api/items/available-items/?search={self.found_item.public_id}')
        self.assertEqual(id_resp.status_code, http_status.HTTP_200_OK)
        id_results = id_resp.json()
        id_items = id_results if isinstance(id_results, list) else id_results.get('results', [])
        self.assertTrue(len(id_items) >= 1)

    def test_match_candidates_do_not_leak_found_item_photos_or_description_to_student(self):
        """Student viewing matches sees candidate score and holding station, but not found photos/descriptions."""
        lost = LostItem.objects.create(
            user=self.student,
            category='Electronics',
            description='Lost my silver laptop',
        )
        match = Match.objects.create(
            lost_item=lost,
            found_item=self.found_item,
            score=90,
            status=MatchStatus.CANDIDATE,
        )

        self.client.force_authenticate(user=self.student)
        resp = self.client.get('/api/items/matches/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)

        data = resp.json()
        results = data if isinstance(data, list) else data.get('results', [])
        target_match = next((m for m in results if m.get('public_id') == match.public_id), None)
        self.assertIsNotNone(target_match)

        nested_found = target_match.get('found_item', {})
        self.assertEqual(nested_found.get('images'), [])
        self.assertIsNone(nested_found.get('description'))
        self.assertEqual(nested_found.get('title'), 'Electronics')
        self.assertIsNone(nested_found.get('found_location'))
        self.assertEqual(nested_found.get('public_id'), self.found_item.public_id)

    def test_match_notification_does_not_leak_identifying_title_to_student(self):
        """Match notifications do not include the secret found item title."""
        from items.services.matching import evaluate_found_item_matches

        lost = LostItem.objects.create(
            user=self.student,
            category='Electronics',
            description='Apple MacBook Pro 14 Silver M2',
        )

        # Re-trigger matching for found item
        evaluate_found_item_matches(self.found_item, notify=True)

        notif = Notification.objects.filter(user=self.student, notification_type='MATCH_FOUND').first()
        self.assertIsNotNone(notif)
        self.assertNotIn(self.secret_title, notif.message)
        self.assertNotIn(self.secret_description, notif.message)
        self.assertIn(self.found_item.public_id, notif.message)
        self.assertIn("Electronics", notif.message)

    def test_student_found_item_cannot_be_deleted_by_student(self):
        """Students cannot hard-delete found reports - DELETE returns 403 Forbidden."""
        item = FoundItem.objects.create(
            user=self.student,
            source='student_report',
            title='Found Calculator',
            category='Electronics',
            status=ItemStatus.DEPOSIT_PENDING,
        )
        self.client.force_authenticate(user=self.student)
        resp = self.client.delete(f'/api/items/student-found/{item.public_id}/')
        self.assertEqual(resp.status_code, http_status.HTTP_403_FORBIDDEN)
        self.assertTrue(FoundItem.objects.filter(public_id=item.public_id).exists())

    def test_ownership_verification_answer_redacted_for_third_party(self):
        """Third party cannot read private ownership verification answers."""
        from pickup.models import Claim, OwnershipVerification
        from pickup.serializers import OwnershipVerificationSerializer

        student2 = User.objects.create_user(
            email='other_student@college.edu',
            password='password123',
            name='Other Student',
            role='student',
            mobile_number='+1888888888',
        )

        claim = Claim.objects.create(
            student=self.student,
            found_item=self.found_item,
            status='PENDING_REVIEW',
        )
        verif = OwnershipVerification.objects.create(
            claim=claim,
            question='What is the lock screen wallpaper?',
            student_answer='Secret Family Photo on Beach',
        )

        # 1. Staff can view the real answer
        factory_req_staff = type('Request', (), {'user': self.admin})()
        serializer_staff = OwnershipVerificationSerializer(verif, context={'request': factory_req_staff})
        self.assertEqual(serializer_staff.data['student_answer'], 'Secret Family Photo on Beach')

        # 2. Claim owner can view their own answer
        factory_req_owner = type('Request', (), {'user': self.student})()
        serializer_owner = OwnershipVerificationSerializer(verif, context={'request': factory_req_owner})
        self.assertEqual(serializer_owner.data['student_answer'], 'Secret Family Photo on Beach')

        # 3. Third-party student has answer redacted
        factory_req_third_party = type('Request', (), {'user': student2})()
        serializer_third_party = OwnershipVerificationSerializer(verif, context={'request': factory_req_third_party})
        self.assertEqual(serializer_third_party.data['student_answer'], '[Protected Verification Detail]')
