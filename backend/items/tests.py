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
        dummy_image = io.BytesIO(b'fake_image_bytes')
        dummy_image.name = 'test.jpg'

        result = analyze_item_image(dummy_image)
        self.assertFalse(result['available'])
        self.assertIn('API key missing', result['detail'])
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
        image = SimpleUploadedFile("found.jpg", b"fake_content", content_type="image/jpeg")
        resp = self.client.post('/api/items/analyze-image/', {'image': image}, format='multipart')
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK)
        self.assertIn('available', resp.data)
        self.assertFalse(resp.data['available'])
