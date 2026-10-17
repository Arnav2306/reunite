"""
Reunite Phase 3A — Items & Matching Test Suite
================================================
Covers:
  - Lost item report isolation (student sees only own reports)
  - Student cannot access another student's report
  - Real matching score calculation
  - Category signal
  - Attribute/text similarity signal
  - Location signal
  - Time signal
  - Unavailable signals (photo) are not fabricated
  - Score thresholds (labels)
  - Algorithm version field
  - Duplicate match prevention (update_or_create)
  - Security: private FoundItem fields are NOT returned to students
  - Match → existing claim workflow integration
  - Matches API student isolation
"""

import os
import io
import json
import uuid
import datetime

from django.test import TestCase
from django.utils import timezone

from rest_framework.test import APIClient
from rest_framework import status as http_status

from accounts.models import User
from items.models import FoundItem, LostItem, ItemStatus, Match, MatchStatus
from items.serializers import AvailableItemPublicSerializer, MatchSerializer
from items.services.matching import (
    calculate_match_score,
    evaluate_lost_item_matches,
    evaluate_found_item_matches,
    get_match_label,
    ALGORITHM_VERSION,
)
from collectionpoint.models import CollectionPoint


# ---------------------------------------------------------------------------
# Shared fixture base
# ---------------------------------------------------------------------------

class BaseItemFixture(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.student = User.objects.create_user(
            email='student@college.edu',
            password='pass123',
            name='Alice Student',
            role='student',
        )
        self.student2 = User.objects.create_user(
            email='student2@college.edu',
            password='pass123',
            name='Bob Student',
            role='student',
        )
        self.staff = User.objects.create_user(
            email='staff@college.edu',
            password='pass123',
            name='Staff User',
            role='custodian',
            is_staff=True,
        )

        self.cp = CollectionPoint.objects.create(
            public_id=str(uuid.uuid4()),
            station_code='HOD-CS-01',
            building='CS Block',
            floor='2nd Floor',
            station_type='HOD Cabin',
        )

        # Published FoundItem (safe for students to view)
        self.found_item = FoundItem.objects.create(
            public_id=str(uuid.uuid4()),
            user=self.staff,
            title='Black Wireless Headphones',
            category='Electronics',
            description='Black wireless bluetooth headphones found near main canteen.',
            found_date=datetime.date(2025, 10, 1),
            found_location='Main Canteen',
            collection_point=self.cp,
            is_published=True,
            published_at=timezone.now(),
            status=ItemStatus.SECURE_HOLD,
            # Private fields — must never be exposed to students
            serial_number='SN-XYZ-001',
            imei='123456789012345',
            identifying_marks='Slight crack on left ear cup',
            internal_notes='Found near table 4',
            secret_verification_info='Owner mentioned sticker on headband',
        )

        # LostItem for student
        self.lost_item = LostItem.objects.create(
            public_id=str(uuid.uuid4()),
            user=self.student,
            category='Electronics',
            description='Black wireless headphones, Bluetooth, used for studying',
            original_answers={
                'lost_location': 'Main Canteen',
                'lost_date': '2025-09-30',
                'lost_time': '2:00 PM',
            },
            normalized_attributes={
                'color': 'black',
                'type': 'headphones',
                'connectivity': 'bluetooth',
            },
            status=ItemStatus.REPORTED,
        )

        # LostItem for student2
        self.lost_item2 = LostItem.objects.create(
            public_id=str(uuid.uuid4()),
            user=self.student2,
            category='Keys',
            description='Blue lanyard keyring with 2 keys',
            original_answers={'lost_location': 'Library'},
            normalized_attributes={},
            status=ItemStatus.REPORTED,
        )

    def auth_student(self):
        self.client.force_authenticate(user=self.student)

    def auth_student2(self):
        self.client.force_authenticate(user=self.student2)

    def auth_staff(self):
        self.client.force_authenticate(user=self.staff)


# ---------------------------------------------------------------------------
# 1. Lost Item Report Isolation
# ---------------------------------------------------------------------------

class LostItemReportIsolationTests(BaseItemFixture):
    """Students can only see their own lost item reports."""

    def test_student_sees_only_own_reports(self):
        self.auth_student()
        resp = self.client.get('/api/items/lost-items/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        data = resp.json()
        # Handle both paginated and list responses
        if isinstance(data, dict) and 'results' in data:
            items = data['results']
        else:
            items = data
        ids = [item['public_id'] for item in items]
        self.assertIn(self.lost_item.public_id, ids)
        self.assertNotIn(self.lost_item2.public_id, ids)

    def test_student2_cannot_see_student1_report(self):
        self.auth_student2()
        resp = self.client.get('/api/items/lost-items/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        data = resp.json()
        if isinstance(data, dict) and 'results' in data:
            items = data['results']
        else:
            items = data
        ids = [item['public_id'] for item in items]
        self.assertNotIn(self.lost_item.public_id, ids)
        self.assertIn(self.lost_item2.public_id, ids)

    def test_unauthenticated_cannot_list_lost_items(self):
        resp = self.client.get('/api/items/lost-items/')
        self.assertEqual(resp.status_code, http_status.HTTP_401_UNAUTHORIZED)

    def test_staff_can_see_all_lost_items(self):
        self.auth_staff()
        resp = self.client.get('/api/items/lost-items/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        data = resp.json()
        if isinstance(data, dict) and 'results' in data:
            items = data['results']
        else:
            items = data
        ids = [item['public_id'] for item in items]
        self.assertIn(self.lost_item.public_id, ids)
        self.assertIn(self.lost_item2.public_id, ids)


# ---------------------------------------------------------------------------
# 2. Matching Algorithm Unit Tests
# ---------------------------------------------------------------------------

class MatchingAlgorithmTests(BaseItemFixture):
    """Test deterministic score calculation for individual signals."""

    def test_category_exact_match_boosts_score(self):
        """Same category → category score = 100."""
        score, breakdown = calculate_match_score(self.lost_item, self.found_item)
        self.assertEqual(breakdown['category_score'], 100.0)

    def test_category_mismatch_reduces_score(self):
        """Different categories → category score = 0."""
        lost = LostItem(
            category='Clothing',
            description='Red jacket',
            original_answers={},
            normalized_attributes={},
        )
        found = FoundItem(
            category='Electronics',
            title='Black headphones',
            description='Wireless headphones',
            found_date=None,
            found_location='',
        )
        score, breakdown = calculate_match_score(lost, found)
        self.assertEqual(breakdown['category_score'], 0.0)

    def test_attribute_similarity_high_for_matching_description(self):
        """Good text overlap → attribute score > 50."""
        score, breakdown = calculate_match_score(self.lost_item, self.found_item)
        self.assertGreater(breakdown['attribute_score'], 50.0)

    def test_location_signal_same_location(self):
        """Exact location match → location score = 100."""
        score, breakdown = calculate_match_score(self.lost_item, self.found_item)
        # lost_location = 'Main Canteen', found_location = 'Main Canteen'
        self.assertEqual(breakdown['location_score'], 100.0)

    def test_location_signal_different_location(self):
        """Different location → location score reduced."""
        lost = LostItem(
            category='Electronics',
            description='headphones',
            original_answers={'lost_location': 'Science Block', 'lost_date': '2025-10-01'},
            normalized_attributes={},
        )
        score, breakdown = calculate_match_score(lost, self.found_item)
        # found_location = 'Main Canteen' vs 'Science Block'
        self.assertLess(breakdown['location_score'], 100.0)

    def test_time_signal_same_day(self):
        """Found same day as lost → time score = 100."""
        lost = LostItem(
            category='Electronics',
            description='black headphones',
            original_answers={'lost_date': '2025-10-01'},
            normalized_attributes={},
        )
        # found_date = 2025-10-01
        score, breakdown = calculate_match_score(lost, self.found_item)
        self.assertEqual(breakdown['time_score'], 100.0)

    def test_time_signal_month_gap_reduces_score(self):
        """Found 40 days after lost → time score low."""
        lost = LostItem(
            category='Electronics',
            description='black headphones',
            original_answers={'lost_date': '2025-08-01'},
            normalized_attributes={},
        )
        score, breakdown = calculate_match_score(lost, self.found_item)
        self.assertLess(breakdown['time_score'], 50.0)

    def test_photo_score_is_none_not_fabricated(self):
        """Photo similarity must be None, never a fake number."""
        score, breakdown = calculate_match_score(self.lost_item, self.found_item)
        self.assertIsNone(breakdown['photo_score'])

    def test_algorithm_version_recorded(self):
        """Score breakdown must include the algorithm version."""
        score, breakdown = calculate_match_score(self.lost_item, self.found_item)
        self.assertEqual(breakdown['algorithm_version'], ALGORITHM_VERSION)

    def test_score_in_valid_range(self):
        """Score must always be between 0 and 100."""
        score, breakdown = calculate_match_score(self.lost_item, self.found_item)
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)

    def test_score_thresholds_strong(self):
        self.assertEqual(get_match_label(85), 'Strong Possible Match')
        self.assertEqual(get_match_label(100), 'Strong Possible Match')

    def test_score_thresholds_possible(self):
        self.assertEqual(get_match_label(65), 'Possible Match')
        self.assertEqual(get_match_label(84), 'Possible Match')

    def test_score_thresholds_weak(self):
        self.assertEqual(get_match_label(0), 'Weak Match')
        self.assertEqual(get_match_label(64), 'Weak Match')

    def test_high_quality_candidate_has_good_score(self):
        """Electronics, same location, same-day, overlapping description → high score."""
        score, breakdown = calculate_match_score(self.lost_item, self.found_item)
        # Should be at least a 'Possible Match' (>=65)
        self.assertGreaterEqual(score, 65)


# ---------------------------------------------------------------------------
# 3. Duplicate Match Prevention
# ---------------------------------------------------------------------------

class DuplicateMatchPreventionTests(BaseItemFixture):
    """Match creation must use update_or_create to prevent duplicates."""

    def test_no_duplicate_match_created_on_second_run(self):
        """Running matching twice on the same pair must produce exactly 1 Match record."""
        evaluate_lost_item_matches(self.lost_item, notify=False)
        evaluate_lost_item_matches(self.lost_item, notify=False)
        count = Match.objects.filter(
            lost_item=self.lost_item,
            found_item=self.found_item,
        ).count()
        self.assertEqual(count, 1)

    def test_match_record_updated_not_duplicated_on_republish(self):
        """Publishing a found item again re-runs matching; no duplicate match rows."""
        evaluate_found_item_matches(self.found_item, notify=False)
        evaluate_found_item_matches(self.found_item, notify=False)
        count = Match.objects.filter(
            lost_item=self.lost_item,
            found_item=self.found_item,
        ).count()
        self.assertEqual(count, 1)

    def test_match_has_public_id(self):
        """Each match must have a non-empty public_id."""
        evaluate_lost_item_matches(self.lost_item, notify=False)
        match = Match.objects.get(lost_item=self.lost_item, found_item=self.found_item)
        self.assertTrue(match.public_id)


# ---------------------------------------------------------------------------
# 4. Match API Security — private fields must not leak
# ---------------------------------------------------------------------------

class MatchAPISecurityTests(BaseItemFixture):
    """Ensure private FoundItem fields are never returned via the match API."""

    PRIVATE_FIELDS = [
        'serial_number', 'imei', 'identifying_marks',
        'internal_notes', 'secret_verification_info',
    ]

    def _get_matches(self):
        evaluate_lost_item_matches(self.lost_item, notify=False)
        self.auth_student()
        resp = self.client.get('/api/items/matches/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        return resp.json()

    def test_private_fields_absent_from_match_response(self):
        data = self._get_matches()
        if isinstance(data, dict) and 'results' in data:
            matches = data['results']
        else:
            matches = data

        self.assertTrue(len(matches) > 0, 'Expected at least one match candidate')
        for match in matches:
            found = match.get('found_item', {})
            for private_field in self.PRIVATE_FIELDS:
                self.assertNotIn(
                    private_field, found,
                    msg=f"Private field '{private_field}' leaked via match API"
                )

    def test_student_cannot_access_other_students_matches(self):
        """student2's match must not be visible to student."""
        evaluate_lost_item_matches(self.lost_item2, notify=False)
        self.auth_student()
        resp = self.client.get('/api/items/matches/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        data = resp.json()
        if isinstance(data, dict) and 'results' in data:
            matches = data['results']
        else:
            matches = data
        for match in matches:
            self.assertEqual(
                match.get('lost_item_id'), self.lost_item.id,
                "Student should only see matches for their own lost items"
            )

    def test_available_items_private_fields_not_exposed(self):
        """AvailableItemPublicSerializer must exclude private fields."""
        from django.test import RequestFactory
        factory = RequestFactory()
        request = factory.get('/')
        request.user = self.student

        serializer = AvailableItemPublicSerializer(
            self.found_item,
            context={'request': request}
        )
        data = serializer.data
        for private_field in self.PRIVATE_FIELDS:
            self.assertNotIn(
                private_field, data,
                msg=f"Private field '{private_field}' exposed via AvailableItemPublicSerializer"
            )

    def test_match_api_requires_authentication(self):
        """Unauthenticated access to matches must return 401."""
        resp = self.client.get('/api/items/matches/')
        self.assertEqual(resp.status_code, http_status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# 5. Match → Claim Workflow Integration
# ---------------------------------------------------------------------------

class MatchToClaimWorkflowTests(BaseItemFixture):
    """Match feeds into existing claim workflow via /api/pickup/claims/."""

    def test_student_can_initiate_claim_from_match(self):
        """
        After a match is created, a student can submit a claim
        against the matched found item using the existing claim endpoint.
        """
        # Set up a match
        evaluate_lost_item_matches(self.lost_item, notify=False)
        self.assertTrue(
            Match.objects.filter(lost_item=self.lost_item, found_item=self.found_item).exists()
        )

        self.auth_student()
        payload = {
            'found_item_id': self.found_item.public_id,
            'student_answer': 'I can identify it by the crack on the left ear cup and "AL" initials written inside.',
        }
        resp = self.client.post('/api/pickup/claims/', payload, format='json')
        self.assertIn(resp.status_code, [http_status.HTTP_201_CREATED, http_status.HTTP_200_OK])
        data = resp.json()
        self.assertEqual(data.get('status'), 'PENDING')

    def test_lost_item_status_updates_to_match_found_on_high_score(self):
        """When a high-confidence match is created, LostItem.status should update."""
        evaluate_lost_item_matches(self.lost_item, notify=False)
        self.lost_item.refresh_from_db()

        # Since we have a high-quality match (Electronics, same location, same day),
        # status should be MATCH_FOUND
        match = Match.objects.filter(lost_item=self.lost_item, found_item=self.found_item).first()
        if match and match.score >= 65:
            self.assertEqual(self.lost_item.status, ItemStatus.MATCH_FOUND)


# ---------------------------------------------------------------------------
# 6. Lost Item Matches Sub-Endpoint
# ---------------------------------------------------------------------------

class LostItemMatchesEndpointTests(BaseItemFixture):
    """Tests for GET /api/items/lost-items/{id}/matches/ endpoint."""

    def test_student_can_get_matches_for_own_report(self):
        evaluate_lost_item_matches(self.lost_item, notify=False)
        self.auth_student()
        resp = self.client.get(f'/api/items/lost-items/{self.lost_item.id}/matches/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        data = resp.json()
        if isinstance(data, dict) and 'results' in data:
            matches = data['results']
        else:
            matches = data
        # Should have at least the one match we created
        self.assertGreaterEqual(len(matches), 1)

    def test_student_cannot_get_matches_for_other_students_report(self):
        """Student cannot fetch matches belonging to another student's lost report."""
        evaluate_lost_item_matches(self.lost_item2, notify=False)
        self.auth_student()
        resp = self.client.get(f'/api/items/lost-items/{self.lost_item2.id}/matches/')
        self.assertEqual(resp.status_code, http_status.HTTP_403_FORBIDDEN)

    def test_matches_endpoint_private_fields_absent(self):
        """Private fields must not appear in per-report matches response."""
        evaluate_lost_item_matches(self.lost_item, notify=False)
        self.auth_student()
        resp = self.client.get(f'/api/items/lost-items/{self.lost_item.id}/matches/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        data = resp.json()
        if isinstance(data, dict) and 'results' in data:
            matches = data['results']
        else:
            matches = data
        for match in matches:
            found = match.get('found_item', {})
            for field in ['serial_number', 'imei', 'identifying_marks', 'internal_notes', 'secret_verification_info']:
                self.assertNotIn(field, found)

    def test_match_score_in_valid_range(self):
        """All returned match scores must be between 0 and 100."""
        evaluate_lost_item_matches(self.lost_item, notify=False)
        self.auth_student()
        resp = self.client.get(f'/api/items/lost-items/{self.lost_item.id}/matches/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        data = resp.json()
        if isinstance(data, dict) and 'results' in data:
            matches = data['results']
        else:
            matches = data
        for match in matches:
            self.assertGreaterEqual(match['score'], 0)
            self.assertLessEqual(match['score'], 100)

    def test_match_includes_label(self):
        """Each match must include a human-readable label field."""
        evaluate_lost_item_matches(self.lost_item, notify=False)
        self.auth_student()
        resp = self.client.get(f'/api/items/lost-items/{self.lost_item.id}/matches/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        data = resp.json()
        if isinstance(data, dict) and 'results' in data:
            matches = data['results']
        else:
            matches = data
        for match in matches:
            self.assertIn(match.get('label'), ['Strong Possible Match', 'Possible Match', 'Weak Match'])

    def test_match_includes_algorithm_version(self):
        """Each match must include the algorithm version."""
        evaluate_lost_item_matches(self.lost_item, notify=False)
        self.auth_student()
        resp = self.client.get(f'/api/items/lost-items/{self.lost_item.id}/matches/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        data = resp.json()
        if isinstance(data, dict) and 'results' in data:
            matches = data['results']
        else:
            matches = data
        for match in matches:
            self.assertIn('matching_algorithm_version', match)
            self.assertTrue(match['matching_algorithm_version'])


# ---------------------------------------------------------------------------
# 7. Run-Matching Action
# ---------------------------------------------------------------------------

class RunMatchingActionTests(BaseItemFixture):
    """Tests for POST /api/items/lost-items/{id}/run-matching/ action."""

    def test_student_can_trigger_matching_for_own_report(self):
        self.auth_student()
        resp = self.client.post(f'/api/items/lost-items/{self.lost_item.id}/run-matching/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)

    def test_student_cannot_trigger_matching_for_other_report(self):
        self.auth_student()
        resp = self.client.post(f'/api/items/lost-items/{self.lost_item2.id}/run-matching/')
        self.assertEqual(resp.status_code, http_status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# 8. Match Dismiss Action
# ---------------------------------------------------------------------------

class MatchDismissTests(BaseItemFixture):
    """Tests for POST /api/items/matches/{id}/dismiss/ action."""

    def test_student_can_dismiss_own_match(self):
        evaluate_lost_item_matches(self.lost_item, notify=False)
        match = Match.objects.filter(lost_item=self.lost_item).first()
        self.assertIsNotNone(match)

        self.auth_student()
        resp = self.client.post(f'/api/items/matches/{match.id}/dismiss/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        match.refresh_from_db()
        self.assertEqual(match.status, MatchStatus.DISMISSED)

    def test_student_cannot_dismiss_other_students_match(self):
        match2 = Match.objects.create(
            lost_item=self.lost_item2,
            found_item=self.found_item,
            score=75,
            status=MatchStatus.CANDIDATE,
            score_breakdown={'category': 30, 'attributes': 45}
        )

        self.auth_student()
        resp = self.client.post(f'/api/items/matches/{match2.id}/dismiss/')
        self.assertEqual(resp.status_code, http_status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# 9. AI Description Service Tests
# ---------------------------------------------------------------------------

class AIDescriptionServiceTests(BaseItemFixture):
    """Tests for AI-assisted image description extraction and fallback."""

    def test_ai_graceful_degradation_when_no_api_key(self):
        from items.services.ai_description import analyze_item_image
        import io
        # Must be >= 32 bytes to pass image size validation before reaching key check
        dummy_image = io.BytesIO(b'fake_image_bytes_padded_to_satisfy_size_check_12345678')
        dummy_image.name = 'test.jpg'

        result = analyze_item_image(dummy_image)
        self.assertFalse(result['available'])
        # The service reports 'not configured' when no API keys are set
        self.assertTrue(
            'not configured' in result['detail'].lower() or
            'api key' in result['detail'].lower() or
            'GEMINI_API_KEY' in result['detail'] or
            'manual' in result['detail'].lower()
        )
        self.assertIsNone(result['suggestion'])

    def test_ai_analyze_endpoint_requires_auth(self):
        resp = self.client.post('/api/items/analyze-image/')
        self.assertEqual(resp.status_code, http_status.HTTP_401_UNAUTHORIZED)

    def test_ai_analyze_endpoint_requires_image(self):
        self.auth_student()
        resp = self.client.post('/api/items/analyze-image/', {})
        self.assertEqual(resp.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('No image file provided', resp.data.get('detail', ''))

    def test_ai_analyze_endpoint_with_image_returns_graceful_response(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.auth_student()
        image = SimpleUploadedFile("found.jpg", b"fake_content_long_enough_for_image_bytes_check_32bytes", content_type="image/jpeg")
        resp = self.client.post('/api/items/analyze-image/', {'image': image}, format='multipart')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        self.assertIn('available', resp.data)

    def test_call_gemini_vision_mocked_success(self):
        import io
        from unittest.mock import patch, MagicMock
        from items.services.ai_description import call_gemini_vision

        mock_payload = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "category": "Electronics",
                                    "item_name": "Blue Wireless Headphones",
                                    "primary_color": "Blue",
                                    "secondary_colors": "Black",
                                    "brand": "Sony",
                                    "confidence": "High",
                                    "approximate_description": "Found blue Sony wireless over-ear headphones."
                                })
                            }
                        ]
                    }
                }
            ]
        }
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_payload).encode('utf-8')
        mock_resp.__enter__.return_value = mock_resp

        with patch('urllib.request.urlopen', return_value=mock_resp):
            parsed, err, cat = call_gemini_vision("test_key", "base64data", "image/jpeg", "prompt")
            self.assertIsNotNone(parsed)
            self.assertIsNone(err)
            self.assertEqual(parsed['item_name'], "Blue Wireless Headphones")
            self.assertEqual(parsed['primary_color'], "Blue")
            self.assertEqual(parsed['brand'], "Sony")

    def test_call_gemini_vision_mocked_429_quota_exhausted(self):
        import urllib.error
        from unittest.mock import patch
        from items.services.ai_description import call_gemini_vision

        http_err = urllib.error.HTTPError(
            url='https://generativelanguage.googleapis.com',
            code=429,
            msg='Quota exceeded',
            hdrs={},
            fp=io.BytesIO(b'{"error": "RESOURCE_EXHAUSTED"}')
        )
        with patch('urllib.request.urlopen', side_effect=http_err):
            parsed, err, cat = call_gemini_vision("test_key", "base64data", "image/jpeg", "prompt")
            self.assertIsNone(parsed)
            self.assertEqual(cat, 'quota_exhausted')
            self.assertIn('429', err)

    def test_call_gemini_vision_mocked_503_service_unavailable(self):
        import urllib.error
        from unittest.mock import patch
        from items.services.ai_description import call_gemini_vision

        http_err = urllib.error.HTTPError(
            url='https://generativelanguage.googleapis.com',
            code=503,
            msg='Service Unavailable',
            hdrs={},
            fp=io.BytesIO(b'{"error": "High demand"}')
        )
        with patch('urllib.request.urlopen', side_effect=http_err):
            parsed, err, cat = call_gemini_vision("test_key", "base64data", "image/jpeg", "prompt")
            self.assertIsNone(parsed)
            self.assertEqual(cat, 'service_unavailable')
            self.assertIn('503', err)

    def test_analyze_item_image_with_mocked_gemini_success(self):
        import io
        from unittest.mock import patch
        from items.services.ai_description import analyze_item_image

        dummy_image = io.BytesIO(b'image_bytes_exceeding_32_bytes_boundary_for_test_12345678')
        dummy_image.name = 'item.jpg'

        mock_gemini_data = {
            "category": "Electronics",
            "item_name": "Silver Apple MacBook Pro",
            "primary_color": "Silver",
            "brand": "Apple",
            "confidence": "High",
            "approximate_description": "Silver 14-inch Apple MacBook laptop in good physical condition."
        }
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'mock_gemini_key'}):
            with patch('items.services.ai_description.call_gemini_vision', return_value=(mock_gemini_data, None, None)):
                result = analyze_item_image(dummy_image)
                self.assertTrue(result['available'])
                self.assertEqual(result['provider'], 'gemini')
                s = result['suggestion']
                self.assertEqual(s['suggested_title'], 'Silver Apple MacBook Pro')
                self.assertEqual(s['brand'], 'Apple')
                self.assertEqual(s['risk_tier'], 1)  # Electronics is valuable -> tier 1

    def test_analyze_item_image_fallback_to_openai_when_gemini_fails(self):
        import io
        from unittest.mock import patch
        from items.services.ai_description import analyze_item_image

        dummy_image = io.BytesIO(b'image_bytes_exceeding_32_bytes_boundary_for_test_12345678')
        dummy_image.name = 'bottle.jpg'

        mock_openai_data = {
            "category": "Bottles & Containers",
            "item_name": "Steel Water Bottle",
            "primary_color": "Silver",
            "brand": "Milton",
            "confidence": "High",
            "approximate_description": "Stainless steel insulated water bottle."
        }
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'mock_gemini_key', 'OPENAI_API_KEY': 'mock_openai_key'}):
            with patch('items.services.ai_description.call_gemini_vision', return_value=(None, "HTTP 429 quota reached", "quota_exhausted")):
                with patch('items.services.ai_description.call_openai_vision', return_value=(mock_openai_data, None, None)):
                    result = analyze_item_image(dummy_image)
                    self.assertTrue(result['available'])
                    self.assertEqual(result['provider'], 'openai')
                    self.assertIn('Fallback used', result['detail'])
                    s = result['suggestion']
                    self.assertEqual(s['suggested_title'], 'Steel Water Bottle')
                    self.assertEqual(s['risk_tier'], 0)  # Bottle is general -> tier 0

    def test_analyze_item_image_detects_vehicle_keys(self):
        import io
        from unittest.mock import patch
        from items.services.ai_description import analyze_item_image

        dummy_image = io.BytesIO(b'image_bytes_exceeding_32_bytes_boundary_for_test_12345678')
        dummy_image.name = 'key.jpg'

        mock_gemini_data = {
            "category": "Vehicle Keys",
            "item_name": "Honda Motorcycle Key",
            "primary_color": "Black",
            "brand": "Honda",
            "confidence": "High",
            "approximate_description": "Black remote key fob with Honda logo and metallic ring."
        }
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'mock_gemini_key'}):
            with patch('items.services.ai_description.call_gemini_vision', return_value=(mock_gemini_data, None, None)):
                result = analyze_item_image(dummy_image)
                self.assertTrue(result['available'])
                s = result['suggestion']
                self.assertEqual(s['suggested_category'], 'Vehicle Keys')
                self.assertEqual(s['suggested_title'], 'Honda Motorcycle Key')

    def test_ai_analyze_endpoint_returns_populated_suggestion_on_success(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from unittest.mock import patch

        self.auth_student()
        image = SimpleUploadedFile("found_phone.jpg", b"valid_image_bytes_padded_exceeding_32_bytes_for_size", content_type="image/jpeg")

        mock_gemini_data = {
            "category": "Phone",
            "item_name": "Black Smartphone",
            "primary_color": "Black",
            "brand": "Samsung",
            "confidence": "High",
            "approximate_description": "Black Samsung Galaxy phone with cracked screen protector."
        }
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'mock_gemini_key'}):
            with patch('items.services.ai_description.call_gemini_vision', return_value=(mock_gemini_data, None, None)):
                resp = self.client.post('/api/items/analyze-image/', {'image': image}, format='multipart')
                self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
                self.assertTrue(resp.data['available'])
                self.assertEqual(resp.data['provider'], 'gemini')
                s = resp.data['suggestion']
                self.assertEqual(s['suggested_title'], 'Black Smartphone')
                self.assertEqual(s['primary_color'], 'Black')
                self.assertEqual(s['brand'], 'Samsung')
                self.assertEqual(s['risk_tier'], 1)


# ---------------------------------------------------------------------------
# 10. Audit Resolution & Extended Features Tests
# ---------------------------------------------------------------------------

class ExtendedFeaturesTests(BaseItemFixture):
    def test_lost_item_partial_update(self):
        lost = LostItem.objects.create(
            user=self.student,
            category='Electronics',
            description='Black Dell laptop',
            status='REPORTED',
        )
        self.auth_student()
        resp = self.client.patch(f'/api/items/lost-items/{lost.id}/', {
            'description': 'Black Dell Inspiron laptop with stickers',
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        lost.refresh_from_db()
        self.assertEqual(lost.description, 'Black Dell Inspiron laptop with stickers')

    def test_cross_user_lost_item_update_forbidden(self):
        lost = LostItem.objects.create(
            user=self.student2,
            category='Electronics',
            description='Other user laptop',
            status='REPORTED',
        )
        self.auth_student()  # Logged in as student 1
        resp = self.client.patch(f'/api/items/lost-items/{lost.id}/', {
            'description': 'Attempting unauthorized edit',
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_403_FORBIDDEN)

    def test_lost_item_cancellation_preserves_record(self):
        lost = LostItem.objects.create(
            user=self.student,
            category='Documents',
            description='Student ID card',
            status='REPORTED',
        )
        self.auth_student()
        resp = self.client.post(f'/api/items/lost-items/{lost.id}/cancel/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        lost.refresh_from_db()
        self.assertEqual(lost.status, 'CANCELLED')
        # Record still exists in database
        self.assertTrue(LostItem.objects.filter(id=lost.id).exists())

    def test_cannot_carry_found_item_flag(self):
        item = FoundItem.objects.create(
            user=self.student,
            category='Bags',
            description='Heavy blue travel bag left near staircase',
            found_location='Library entrance',
            cannot_carry=True,
            cannot_carry_details='2nd floor main staircase landing',
            status='REPORTED',
        )
        self.assertTrue(item.cannot_carry)
        self.assertEqual(item.cannot_carry_details, '2nd floor main staircase landing')

    def test_match_feedback_submission(self):
        lost = LostItem.objects.create(
            user=self.student,
            category='Keys',
            description='Dorm room keys',
            status='REPORTED',
        )
        match = Match.objects.create(
            lost_item=lost,
            found_item=self.found_item,
            score=82,
            status=MatchStatus.CANDIDATE,
            score_breakdown={'category': 40, 'attributes': 42},
        )
        self.auth_student()
        resp = self.client.post(f'/api/items/matches/{match.id}/feedback/', {
            'feedback': 'HELPFUL',
            'notes': 'This looks very similar to my keychain',
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        match.refresh_from_db()
        self.assertTrue(match.user_feedback)
        self.assertEqual(match.feedback_notes, 'This looks very similar to my keychain')

    def test_admin_stats_endpoint(self):
        self.auth_staff()
        resp = self.client.get('/api/items/admin-stats/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        self.assertIn('total_found', resp.data)
        self.assertIn('pending_claims', resp.data)
        self.assertIn('pending_handovers', resp.data)

    def test_unavailable_station_cannot_be_selected_for_deposit(self):
        from collectionpoint.models import CollectionPoint
        inactive_station = CollectionPoint.objects.create(
            public_id='cp-inactive-999',
            station_code='STAT-INACT',
            building='Closed Building',
            status='INACTIVE',
        )
        self.auth_student()
        resp = self.client.post('/api/items/student-found/', {
            'title': 'Lost Keys Found',
            'category': 'Keys',
            'description': 'Found near entrance',
            'found_date': '2026-10-10',
            'found_location': 'Closed Building',
            'collection_point': inactive_station.id,
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn('collection_point', resp.data)

    def test_cannot_carry_sets_reported_status_not_deposit_pending(self):
        self.auth_student()
        resp = self.client.post('/api/items/student-found/', {
            'title': 'Heavy Mountain Bike',
            'category': 'Other',
            'description': 'Locked heavy mountain bike left abandoned',
            'found_date': '2026-10-10',
            'found_location': 'Campus Bike Racks',
            'cannot_carry': True,
            'cannot_carry_details': 'Too heavy to transport to lost & found desk',
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED)
        self.assertEqual(resp.data['status'], 'REPORTED')
        created_item = FoundItem.objects.get(id=resp.data['id'])
        self.assertEqual(created_item.status, ItemStatus.REPORTED)


# ---------------------------------------------------------------------------
# 11. Category-Specific Questions Regression Tests
# ---------------------------------------------------------------------------

class CategoryQuestionsRegressionTests(BaseItemFixture):
    def test_all_categories_have_3_to_4_questions(self):
        from items.services.question_bank import CATEGORY_QUESTION_BANK, QUESTION_BANK_VERSION
        self.assertEqual(QUESTION_BANK_VERSION, '2026.1')
        self.assertGreaterEqual(len(CATEGORY_QUESTION_BANK), 10)

        for cat_name, questions in CATEGORY_QUESTION_BANK.items():
            self.assertIn(
                len(questions), [3, 4],
                f"Category '{cat_name}' must have 3 or 4 questions, but has {len(questions)}."
            )
            for q in questions:
                self.assertIn('key', q)
                self.assertIn('label', q)
                self.assertIn('options', q)
                self.assertGreaterEqual(len(q['options']), 4)
                # Check inclusion of 'Other' and uncertainty options
                options_str = " ".join(q['options']).lower()
                self.assertIn('other', options_str, f"Category '{cat_name}' question '{q['key']}' missing Other")
                self.assertTrue(
                    'not sure' in options_str or 'none' in options_str or 'generic' in options_str,
                    f"Category '{cat_name}' question '{q['key']}' missing uncertainty option"
                )

    def test_phone_category_questions_relevance(self):
        from items.services.question_bank import get_category_questions
        questions = get_category_questions('Phone')
        keys = [q['key'] for q in questions]
        self.assertEqual(keys, ['brand', 'main_color', 'case_style', 'distinguishing_feature'])

    def test_laptop_category_questions_relevance(self):
        from items.services.question_bank import get_category_questions
        questions = get_category_questions('Laptop')
        keys = [q['key'] for q in questions]
        self.assertEqual(keys, ['brand', 'model_family', 'main_color', 'distinctive_mark'])

    def test_backpack_category_questions_relevance(self):
        from items.services.question_bank import get_category_questions
        questions = get_category_questions('Backpack & Bags')
        keys = [q['key'] for q in questions]
        self.assertEqual(keys, ['main_color', 'brand', 'bag_type', 'distinguishing_feature'])

    def test_wallet_category_questions_relevance(self):
        from items.services.question_bank import get_category_questions
        questions = get_category_questions('Wallet & Cards')
        keys = [q['key'] for q in questions]
        self.assertEqual(keys, ['main_color', 'material', 'wallet_style', 'distinguishing_mark'])

    def test_keys_category_questions_relevance(self):
        from items.services.question_bank import get_category_questions
        questions = get_category_questions('Keys & Badges')
        keys = [q['key'] for q in questions]
        self.assertEqual(keys, ['key_count_type', 'keychain_presence', 'keychain_style_color', 'distinguishing_feature'])

    def test_bottle_category_questions_relevance(self):
        from items.services.question_bank import get_category_questions
        questions = get_category_questions('Bottles & Containers')
        keys = [q['key'] for q in questions]
        self.assertEqual(keys, ['main_color', 'bottle_type', 'brand', 'distinguishing_feature'])

    def test_headphones_category_questions_relevance(self):
        from items.services.question_bank import get_category_questions
        questions = get_category_questions('Headphones & Earphones')
        self.assertEqual(len(questions), 4)
        keys = [q['key'] for q in questions]
        self.assertEqual(keys, ['form_factor', 'brand', 'main_color', 'distinguishing_feature'])

    def test_chargers_category_questions_relevance(self):
        from items.services.question_bank import get_category_questions
        questions = get_category_questions('Chargers & Cables')
        self.assertEqual(len(questions), 4)
        keys = [q['key'] for q in questions]
        self.assertEqual(keys, ['charger_type', 'brand', 'main_color', 'distinguishing_feature'])

    def test_helmets_category_questions_relevance(self):
        from items.services.question_bank import get_category_questions
        questions = get_category_questions('Helmets & Riding Gear')
        self.assertEqual(len(questions), 4)
        keys = [q['key'] for q in questions]
        self.assertEqual(keys, ['helmet_type', 'brand', 'main_color', 'distinguishing_feature'])

    def test_all_supported_categories_have_3_to_4_mcqs(self):
        from items.services.question_bank import CATEGORY_QUESTION_BANK
        self.assertGreaterEqual(len(CATEGORY_QUESTION_BANK), 16)
        for cat_name, questions in CATEGORY_QUESTION_BANK.items():
            self.assertTrue(3 <= len(questions) <= 4, f"Category {cat_name} must have 3-4 questions, found {len(questions)}")
            for q in questions:
                self.assertIn('key', q)
                self.assertIn('label', q)
                self.assertIn('options', q)
                self.assertGreaterEqual(len(q['options']), 3)
                self.assertIn('Other', q['options'])
        # Query specific category
        resp = self.client.get('/api/items/category-questions/?category=Phone')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        self.assertEqual(resp.data['category'], 'Phone')
        self.assertEqual(len(resp.data['questions']), 4)
        self.assertEqual(resp.data['version'], '2026.1')

        # Query all categories
        resp_all = self.client.get('/api/items/category-questions/')
        self.assertEqual(resp_all.status_code, http_status.HTTP_200_OK)
        self.assertIn('categories', resp_all.data)
        self.assertIn('questions', resp_all.data)

    def test_lost_item_creation_persists_versioned_question_snapshot(self):
        self.auth_student()
        resp = self.client.post('/api/items/lost-items/', {
            'category': 'Phone',
            'description': 'Lost my iPhone in the student center cafeteria',
            'original_answers': {
                'brand': 'Apple (iPhone)',
                'main_color': 'Black / Space Grey',
                'case_style': 'Transparent / Clear case',
                'distinguishing_feature': 'Screen protector / tempered glass installed',
                'lost_location': 'Student Center Cafeteria',
                'lost_date': '2026-10-10',
            }
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED)
        lost_id = resp.data['id']

        lost = LostItem.objects.get(id=lost_id)
        snapshot = lost.original_answers
        self.assertEqual(snapshot['version'], '2026.1')
        self.assertEqual(snapshot['category'], 'Phone')
        self.assertIn('questions', snapshot)
        self.assertEqual(len(snapshot['questions']), 4)
        self.assertEqual(snapshot['answers']['brand'], 'Apple (iPhone)')

        # Verify normalized attributes extracted
        self.assertEqual(lost.normalized_attributes.get('brand'), 'Apple (iPhone)')
        self.assertEqual(lost.normalized_attributes.get('main_color'), 'Black / Space Grey')

    def test_historical_question_stability(self):
        # Create a report with a specific question snapshot
        lost = LostItem.objects.create(
            user=self.student,
            category='Laptop',
            description='Dell laptop left in lab',
            original_answers={
                'version': '2025.0',  # Older version
                'category': 'Laptop',
                'questions': [
                    {'key': 'brand', 'label': 'Brand', 'options': ['Dell', 'HP'], 'selected': 'Dell'}
                ],
                'answers': {'brand': 'Dell'}
            },
            status=ItemStatus.REPORTED
        )
        self.auth_student()
        resp = self.client.get(f'/api/items/lost-items/{lost.id}/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        # Ensure the older snapshot version and questions were preserved without modification
        self.assertEqual(resp.data['original_answers']['version'], '2025.0')
        self.assertEqual(len(resp.data['original_answers']['questions']), 1)
        self.assertEqual(resp.data['original_answers']['answers']['brand'], 'Dell')



# ---------------------------------------------------------------------------
# 12. Vehicle Keys Category Tests
# ---------------------------------------------------------------------------

class VehicleKeysCategoryTests(BaseItemFixture):
    """Phase 9 requirement coverage for Vehicle Keys category."""

    def test_vehicle_keys_in_question_bank_with_4_mcqs(self):
        from items.services.question_bank import CATEGORY_QUESTION_BANK
        self.assertIn('Vehicle Keys', CATEGORY_QUESTION_BANK)
        self.assertEqual(len(CATEGORY_QUESTION_BANK['Vehicle Keys']), 4)

    def test_vehicle_keys_mcq_keys_and_options(self):
        from items.services.question_bank import CATEGORY_QUESTION_BANK
        questions = CATEGORY_QUESTION_BANK['Vehicle Keys']
        keys_found = {q['key'] for q in questions}
        self.assertIn('vehicle_type', keys_found)
        self.assertIn('key_type', keys_found)
        self.assertIn('key_appearance', keys_found)
        self.assertIn('distinguishing_feature', keys_found)
        for q in questions:
            self.assertGreaterEqual(len(q['options']), 3)
            self.assertIn('Not sure', q['options'])

    def test_vehicle_keys_vehicle_type_options(self):
        from items.services.question_bank import CATEGORY_QUESTION_BANK
        vt = next(q for q in CATEGORY_QUESTION_BANK['Vehicle Keys'] if q['key'] == 'vehicle_type')
        for expected in ['Motorcycle', 'Scooty', 'Car', 'Other vehicle', 'Not sure']:
            self.assertIn(expected, vt['options'])

    def test_vehicle_keys_appears_in_api_categories(self):
        self.auth_student()
        resp = self.client.get('/api/items/category-questions/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        self.assertIn('Vehicle Keys', resp.data.get('categories', []))

    def test_vehicle_keys_questions_via_api(self):
        self.auth_student()
        resp = self.client.get('/api/items/category-questions/?category=Vehicle Keys')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        self.assertEqual(resp.data['category'], 'Vehicle Keys')
        self.assertEqual(len(resp.data['questions']), 4)
        self.assertEqual(resp.data['version'], '2026.1')

    def test_keys_and_badges_still_returns_own_questions(self):
        from items.services.question_bank import get_category_questions
        questions = get_category_questions('Keys & Badges')
        self.assertEqual(len(questions), 4)
        keys = {q['key'] for q in questions}
        self.assertIn('key_count_type', keys)
        self.assertNotIn('vehicle_type', keys)

    def test_keys_and_badges_via_api(self):
        self.auth_student()
        resp = self.client.get('/api/items/category-questions/?category=Keys%20%26%20Badges')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        self.assertEqual(resp.data['category'], 'Keys & Badges')
        self.assertEqual(len(resp.data['questions']), 4)

    def test_vehicle_keys_aliases_resolve_correctly(self):
        from items.services.question_bank import resolve_category_key
        for alias in ['vehicle keys', 'vehicle key', 'vehicle_keys', 'car key', 'car keys',
                      'motorcycle key', 'scooter key', 'scooty key', 'scooty', 'key fob', 'key fobs', 'remote key',
                      'smart key', 'proximity key']:
            resolved = resolve_category_key(alias)
            self.assertEqual(resolved, 'Vehicle Keys',
                             f"Alias '{alias}' should resolve to 'Vehicle Keys', got '{resolved}'")

    def test_generic_key_aliases_still_resolve_to_keys_and_badges(self):
        from items.services.question_bank import resolve_category_key
        for alias in ['keychain', 'badge']:
            resolved = resolve_category_key(alias)
            self.assertEqual(resolved, 'Keys & Badges',
                             f"Alias '{alias}' should resolve to 'Keys & Badges', got '{resolved}'")

    def test_vehicle_keys_answers_persisted_in_snapshot(self):
        self.auth_student()
        resp = self.client.post('/api/items/lost-items/', {
            'category': 'Vehicle Keys',
            'description': 'Lost motorcycle key with black remote fob',
            'original_answers': {
                'vehicle_type': 'Motorcycle',
                'key_type': 'Remote key fob',
                'key_appearance': 'Mainly black',
                'distinguishing_feature': 'Keychain or tag attached',
                'lost_location': 'Parking Lot',
                'lost_date': '2026-10-12',
            }
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED, resp.data)
        from items.models import LostItem as LI
        lost = LI.objects.get(id=resp.data['id'])
        snapshot = lost.original_answers
        self.assertEqual(snapshot['version'], '2026.1')
        self.assertEqual(snapshot['category'], 'Vehicle Keys')
        self.assertEqual(len(snapshot['questions']), 4)
        self.assertEqual(snapshot['answers']['vehicle_type'], 'Motorcycle')

    def test_vehicle_keys_normalized_attributes_extracted(self):
        self.auth_student()
        resp = self.client.post('/api/items/lost-items/', {
            'category': 'Vehicle Keys',
            'description': 'Lost Honda scooty key',
            'original_answers': {
                'vehicle_type': 'Scooty',
                'key_type': 'Traditional metal key',
                'key_appearance': 'Mainly silver or metallic',
                'distinguishing_feature': 'No obvious distinctive feature',
                'lost_date': '2026-10-12',
            }
        }, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED, resp.data)
        from items.models import LostItem as LI2
        lost = LI2.objects.get(id=resp.data['id'])
        attrs = lost.normalized_attributes
        self.assertIn('vehicle_type', attrs)
        self.assertEqual(attrs['vehicle_type'], 'Scooty')
        self.assertEqual(attrs['key_type'], 'Traditional metal key')

    def test_vehicle_keys_historical_snapshot_preserved(self):
        from items.models import LostItem as LI3
        lost = LI3.objects.create(
            user=self.student,
            category='Vehicle Keys',
            description='Old bike key report',
            original_answers={
                'version': '2025.0',
                'category': 'Vehicle Keys',
                'questions': [
                    {'key': 'vehicle_type', 'label': 'Vehicle Type',
                     'options': ['Motorcycle', 'Car'], 'selected': 'Motorcycle'}
                ],
                'answers': {'vehicle_type': 'Motorcycle'}
            },
            status=ItemStatus.REPORTED
        )
        self.auth_student()
        resp = self.client.get(f'/api/items/lost-items/{lost.id}/')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        self.assertEqual(resp.data['original_answers']['version'], '2025.0')
        self.assertEqual(resp.data['original_answers']['answers']['vehicle_type'], 'Motorcycle')

    def test_vehicle_keys_matches_same_category(self):
        lost_vk = LostItem(
            category='Vehicle Keys',
            description='Black Honda Activa scooty key fob with keychain',
            original_answers={'lost_location': 'Block A Parking', 'lost_date': '2026-10-12'},
            normalized_attributes={'vehicle_type': 'Scooty', 'key_type': 'Remote key fob'},
        )
        found_vk = FoundItem(
            category='Vehicle Keys',
            title='Scooty Key Fob',
            description='Black scooty key found near Block A entrance',
            found_date=None,
            found_location='Block A',
        )
        score, breakdown = calculate_match_score(lost_vk, found_vk)
        self.assertEqual(breakdown['category_score'], 100.0)
        self.assertGreater(score, 0)

    def test_vehicle_keys_does_not_match_generic_keys_at_full_score(self):
        lost_vk = LostItem(
            category='Vehicle Keys',
            description='Motorcycle key lost',
            original_answers={},
            normalized_attributes={},
        )
        found_kb = FoundItem(
            category='Keys & Badges',
            title='Key Bundle',
            description='Multiple house keys on a ring',
            found_date=None,
            found_location='',
        )
        _, breakdown = calculate_match_score(lost_vk, found_kb)
        self.assertLess(breakdown['category_score'], 100.0)

    def test_ai_normalizer_resolves_vehicle_key_terms(self):
        from items.services.question_bank import resolve_category_key
        for term in ['vehicle keys', 'car key', 'motorcycle key', 'key fob', 'smart key']:
            self.assertEqual(resolve_category_key(term), 'Vehicle Keys',
                             f"Term '{term}' should normalize to Vehicle Keys")

    def test_found_vehicle_key_can_be_saved_without_ai(self):
        # Student report via student-found
        self.auth_student()
        resp = self.client.post('/api/items/student-found/', {
            'title': 'Vehicle Key Found',
            'category': 'Vehicle Keys',
            'description': 'Found a black remote key fob near the parking lot.',
            'found_location': 'Block A Parking',
            'found_date': '2026-10-12',
            'risk_tier': '0',
            'cannot_carry': 'false',
            'collection_point': self.cp.id,
        }, format='multipart')
        self.assertIn(resp.status_code,
                      [http_status.HTTP_200_OK, http_status.HTTP_201_CREATED], resp.data)

        # Staff registration via admin found-items
        self.auth_staff()
        resp_staff = self.client.post('/api/items/found-items/', {
            'title': 'Vehicle Key Registered',
            'category': 'Vehicle Keys',
            'description': 'Handed in by student: scooter key with silver ring.',
            'found_location': 'Library Entrance',
            'found_date': '2026-10-12',
            'collection_point': self.cp.id,
        }, format='multipart')
        self.assertEqual(resp_staff.status_code, http_status.HTTP_201_CREATED, resp_staff.data)

    def test_all_categories_including_vehicle_keys_have_3_to_4_mcqs(self):
        from items.services.question_bank import CATEGORY_QUESTION_BANK
        self.assertIn('Vehicle Keys', CATEGORY_QUESTION_BANK)
        self.assertGreaterEqual(len(CATEGORY_QUESTION_BANK), 17)
        for cat_name, questions in CATEGORY_QUESTION_BANK.items():
            self.assertTrue(
                3 <= len(questions) <= 4,
                f"Category '{cat_name}' must have 3-4 questions, found {len(questions)}"
            )
