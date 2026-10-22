"""
Fraud Prevention — Targeted Test Suite
=======================================
Tests the fraud-prevention behaviours added in the Phase 3B hardening pass:

  A. Rate limiting on report creation
  B. Duplicate report detection (same-user blocks, cross-user review signal)
  C. Self-match detection and notification suppression
  D. Self-claim prevention via StudentClaimViewSet
  E. Questionable claim-history flagging
  F. Image upload hash recording / cross-account reuse detection
  G. Account-pair collusion signalling
  H. MatchSerializer exposes is_self_match flag correctly

Each test is self-contained and uses the existing fixture helpers from the
models layer only; no external services or Celery are required.
"""

import datetime
import io
import uuid

from django.test import TestCase
from django.utils import timezone

from rest_framework.test import APIClient
from rest_framework import status as http_status

from accounts.models import User
from audit.models import AuditLog
from collectionpoint.models import CollectionPoint
from items.models import FoundItem, LostItem, ItemStatus, Match, MatchStatus
from items.serializers import MatchSerializer
from items.services.fraud_prevention import (
    check_report_rate_limit,
    detect_duplicate_report,
    detect_and_record_image_upload,
    check_collusion_between_accounts,
    check_questionable_claim_history,
)
from items.services.matching import evaluate_lost_item_matches
from notifications.models import Notification
from pickup.models import Claim, ClaimStatus


# ---------------------------------------------------------------------------
# Shared fixture base
# ---------------------------------------------------------------------------

class FraudBaseFixture(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.student = User.objects.create_user(
            email='fraud_student@college.edu',
            password='pass123',
            name='Alice Fraud',
            role='student',
        )
        self.student2 = User.objects.create_user(
            email='fraud_student2@college.edu',
            password='pass123',
            name='Bob Fraud',
            role='student',
        )
        self.staff = User.objects.create_user(
            email='fraud_staff@college.edu',
            password='pass123',
            name='Staff Fraud',
            role='custodian',
            is_staff=True,
        )

        self.cp = CollectionPoint.objects.create(
            public_id=str(uuid.uuid4()),
            station_code='FRAUD-01',
            building='Admin Block',
            floor='Ground',
            station_type='HOD Cabin',
        )

    def auth_student(self):
        self.client.force_authenticate(user=self.student)

    def auth_student2(self):
        self.client.force_authenticate(user=self.student2)

    def auth_staff(self):
        self.client.force_authenticate(user=self.staff)

    def make_lost(self, user, category='Electronics',
                  description='Black wireless headphones',
                  status=ItemStatus.REPORTED, **kwargs):
        return LostItem.objects.create(
            public_id=str(uuid.uuid4()),
            user=user,
            category=category,
            description=description,
            original_answers={'lost_location': 'Canteen', 'lost_date': '2025-10-01'},
            normalized_attributes={'color': 'black', 'type': 'headphones'},
            status=status,
            **kwargs,
        )

    def make_found(self, user, category='Electronics',
                   description='Black Bluetooth headphones',
                   published=True, status=ItemStatus.SECURE_HOLD, **kwargs):
        return FoundItem.objects.create(
            public_id=str(uuid.uuid4()),
            user=user,
            title='Black Bluetooth headphones',
            category=category,
            description=description,
            found_date=datetime.date(2025, 10, 1),
            found_location='Canteen',
            collection_point=self.cp,
            is_published=published,
            published_at=timezone.now() if published else None,
            status=status,
            **kwargs,
        )


# ===========================================================================
# A. Rate limiting
# ===========================================================================

class RateLimitTests(FraudBaseFixture):
    """check_report_rate_limit blocks after 5 submissions in 15 minutes."""

    def test_under_limit_not_blocked(self):
        for _ in range(4):
            self.make_lost(self.student)
        is_limited, count = check_report_rate_limit(self.student, report_type='lost', limit=5)
        self.assertFalse(is_limited)
        self.assertEqual(count, 4)

    def test_at_limit_blocked_and_audit_logged(self):
        for _ in range(5):
            self.make_lost(self.student)
        is_limited, count = check_report_rate_limit(self.student, report_type='lost', limit=5)
        self.assertTrue(is_limited)
        self.assertEqual(count, 5)
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.student,
                action='REPORT_RATE_LIMIT_EXCEEDED',
            ).exists()
        )

    def test_different_type_counted_separately(self):
        for _ in range(5):
            self.make_lost(self.student)
        is_limited_found, _ = check_report_rate_limit(
            self.student, report_type='found', limit=5
        )
        self.assertFalse(is_limited_found)

    def test_rate_limit_endpoint_returns_429(self):
        for _ in range(5):
            self.make_lost(self.student)
        self.auth_student()
        payload = {
            'category': 'Electronics',
            'description': 'Another pair of headphones',
            'original_answers': '{}',
            'normalized_attributes': '{}',
        }
        resp = self.client.post('/api/items/lost-items/', payload, format='json')
        self.assertEqual(resp.status_code, http_status.HTTP_429_TOO_MANY_REQUESTS)


# ===========================================================================
# B. Duplicate report detection
# ===========================================================================

class DuplicateReportDetectionTests(FraudBaseFixture):

    def test_same_user_exact_duplicate_blocked(self):
        self.make_lost(self.student, category='Electronics',
                       description='Black wireless headphones Bluetooth for music')
        is_dup, matched, reason, review_only = detect_duplicate_report(
            user=self.student,
            category='Electronics',
            description='Black wireless headphones Bluetooth for music',
            model_class=LostItem,
        )
        self.assertTrue(is_dup)
        self.assertFalse(review_only)
        self.assertIsNotNone(matched)

    def test_same_user_high_jaccard_duplicate_blocked(self):
        self.make_lost(self.student, category='Electronics',
                       description='black wireless headphones bluetooth')
        is_dup, matched, reason, review_only = detect_duplicate_report(
            user=self.student,
            category='Electronics',
            description='black wireless headphones bluetooth usb',
            model_class=LostItem,
        )
        self.assertTrue(is_dup)
        self.assertFalse(review_only)

    def test_different_category_not_duplicate(self):
        self.make_lost(self.student, category='Electronics',
                       description='black wireless headphones')
        is_dup, _, _, _ = detect_duplicate_report(
            user=self.student,
            category='Accessories',
            description='black wireless headphones',
            model_class=LostItem,
        )
        self.assertFalse(is_dup)

    def test_cross_user_near_duplicate_is_review_signal_only(self):
        self.make_lost(self.student, category='Electronics',
                       description='black wireless sony headphones bluetooth nfc')
        is_dup, matched, reason, review_only = detect_duplicate_report(
            user=self.student2,
            category='Electronics',
            description='black wireless sony headphones bluetooth nfc music',
            model_class=LostItem,
        )
        self.assertFalse(is_dup)
        if matched:
            self.assertTrue(review_only)

    def test_different_user_unrelated_report_no_signal(self):
        self.make_lost(self.student, category='Electronics',
                       description='Black wireless headphones')
        is_dup, matched, reason, review_only = detect_duplicate_report(
            user=self.student2,
            category='Keys',
            description='Yellow lanyard with locker key',
            model_class=LostItem,
        )
        self.assertFalse(is_dup)
        self.assertIsNone(matched)


# ===========================================================================
# C. Self-match detection and notification suppression
# ===========================================================================

class SelfMatchTests(FraudBaseFixture):

    def test_self_match_sets_flag_in_breakdown(self):
        lost = self.make_lost(self.student)
        self.make_found(self.student)  # SAME user
        matches = evaluate_lost_item_matches(lost, notify=True)
        self_matches = [m for m in matches if m.score_breakdown.get('self_match')]
        self.assertTrue(len(self_matches) > 0,
                        'Expected at least one self-match flagged in score_breakdown')

    def test_self_match_no_match_found_notification_sent(self):
        lost = self.make_lost(self.student)
        self.make_found(self.student)
        Notification.objects.all().delete()
        evaluate_lost_item_matches(lost, notify=True)
        notifs = Notification.objects.filter(
            user=self.student,
            notification_type='MATCH_FOUND',
            related_object_id=lost.public_id,
        )
        self.assertEqual(notifs.count(), 0,
                         'Notification must NOT be sent for a self-match pair')

    def test_self_match_audit_log_created(self):
        lost = self.make_lost(self.student)
        self.make_found(self.student)
        evaluate_lost_item_matches(lost, notify=True)
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.student,
                action='SELF_MATCH_FLAGGED_FOR_REVIEW',
            ).exists()
        )

    def test_cross_user_match_no_self_match_audit(self):
        """Legitimate cross-user match → no SELF_MATCH audit created."""
        lost = self.make_lost(self.student)
        self.make_found(self.student2)
        AuditLog.objects.filter(
            actor=self.student,
            action='SELF_MATCH_FLAGGED_FOR_REVIEW',
        ).delete()
        evaluate_lost_item_matches(lost, notify=True)
        self.assertEqual(
            AuditLog.objects.filter(
                actor=self.student,
                action='SELF_MATCH_FLAGGED_FOR_REVIEW',
            ).count(),
            0,
        )

    def test_notification_not_duplicated_on_rerun(self):
        """Running matching twice must not create 2 MATCH_FOUND notifications."""
        lost = self.make_lost(self.student)
        self.make_found(self.student2)
        Notification.objects.all().delete()
        evaluate_lost_item_matches(lost, notify=True)
        evaluate_lost_item_matches(lost, notify=True)
        notifs = Notification.objects.filter(
            user=self.student,
            notification_type='MATCH_FOUND',
            related_object_id=lost.public_id,
        )
        self.assertLessEqual(notifs.count(), 1,
                             'Must not create duplicate MATCH_FOUND notifications')


# ===========================================================================
# D. Self-claim prevention
# ===========================================================================

class SelfClaimPreventionTests(FraudBaseFixture):

    def test_student_cannot_claim_own_found_item(self):
        self.make_lost(self.student)
        found = self.make_found(self.student)  # same user reported found item

        self.auth_student()
        # CreateClaimSerializer expects found_item_id=public_id + student_answer
        payload = {
            'found_item_id': found.public_id,
            'student_answer': 'I own this item, it has a scratch on the left side',
        }
        resp = self.client.post('/api/pickup/claims/', payload, format='json')
        self.assertEqual(
            resp.status_code, http_status.HTTP_403_FORBIDDEN,
            f'Expected 403 for self-claim, got {resp.status_code}: {resp.data}',
        )

    def test_different_user_can_attempt_claim(self):
        self.make_lost(self.student)
        found = self.make_found(self.student2)  # student2 reported found item

        self.auth_student()
        payload = {
            'found_item_id': found.public_id,
            'student_answer': 'I own this, I can describe the identifying mark',
        }
        resp = self.client.post('/api/pickup/claims/', payload, format='json')
        self.assertNotEqual(
            resp.status_code, http_status.HTTP_403_FORBIDDEN,
            'Cross-user claim should not be blocked with 403',
        )


# ===========================================================================
# E. Questionable claim-history flagging
# ===========================================================================

class QuestionableClaimHistoryTests(FraudBaseFixture):

    def _make_rejected_claim(self, student, index):
        found = self.make_found(self.staff, description=f'Found item {index}')
        return Claim.objects.create(
            public_id=str(uuid.uuid4()),
            student=student,
            found_item=found,
            status=ClaimStatus.REJECTED,
        )

    def test_single_rejected_claim_not_flagged(self):
        self._make_rejected_claim(self.student, 1)
        self.assertFalse(check_questionable_claim_history(self.student))

    def test_two_rejected_claims_flagged(self):
        self._make_rejected_claim(self.student, 1)
        self._make_rejected_claim(self.student, 2)
        self.assertTrue(check_questionable_claim_history(self.student))
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.student,
                action='QUESTIONABLE_CLAIM_HISTORY_FLAGGED',
            ).exists()
        )

    def test_other_students_rejected_claims_dont_affect_this_student(self):
        self._make_rejected_claim(self.student2, 1)
        self._make_rejected_claim(self.student2, 2)
        self.assertFalse(check_questionable_claim_history(self.student))


# ===========================================================================
# F. Image upload hash recording and cross-account reuse detection
# ===========================================================================

class ImageReuseDetectionTests(FraudBaseFixture):

    class _FakeFile:
        """Minimal file-like object with seek/read, compatible with calculate_file_hash."""
        def __init__(self, data: bytes):
            self._buf = io.BytesIO(data)

        def seek(self, pos):
            self._buf.seek(pos)

        def read(self, size=-1):
            return self._buf.read(size)

    def test_first_upload_recorded_not_flagged(self):
        f = self._FakeFile(b'unique-image-aaa')
        reused = detect_and_record_image_upload(f, self.student, 'FoundItem', 'fp-1')
        self.assertFalse(reused)
        self.assertTrue(
            AuditLog.objects.filter(actor=self.student, action='IMAGE_UPLOAD_RECORDED').exists()
        )

    def test_same_image_by_different_user_flagged(self):
        content = b'shared-image-unique-content-zzz'
        detect_and_record_image_upload(self._FakeFile(content), self.student, 'FoundItem', 'fp-2')
        reused = detect_and_record_image_upload(self._FakeFile(content), self.student2, 'FoundItem', 'fp-3')
        self.assertTrue(reused)
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.student2,
                action='SUSPICIOUS_IMAGE_REUSE_FLAGGED',
            ).exists()
        )

    def test_same_image_same_user_not_flagged(self):
        content = b'same-user-same-image'
        detect_and_record_image_upload(self._FakeFile(content), self.student, 'FoundItem', 'fp-4')
        reused = detect_and_record_image_upload(self._FakeFile(content), self.student, 'LostItem', 'fp-5')
        self.assertFalse(reused)

    def test_different_images_different_users_not_flagged(self):
        detect_and_record_image_upload(self._FakeFile(b'img-alpha'), self.student, 'FoundItem', 'fp-6')
        reused = detect_and_record_image_upload(self._FakeFile(b'img-beta'), self.student2, 'LostItem', 'fp-7')
        self.assertFalse(reused)


# ===========================================================================
# G. Account-pair collusion signalling
# ===========================================================================

class CollusionDetectionTests(FraudBaseFixture):

    def _make_match_pair(self, user_a, user_b, index):
        lost = self.make_lost(user_a, description=f'Collusion lost {index}')
        found = self.make_found(user_b, description=f'Collusion found {index}')
        return Match.objects.create(
            public_id=str(uuid.uuid4()),
            lost_item=lost,
            found_item=found,
            score=75,
            score_breakdown={},
            matching_algorithm_version='v1',
            status=MatchStatus.CANDIDATE,
        )

    def test_below_threshold_not_flagged(self):
        for i in range(2):
            self._make_match_pair(self.student, self.student2, i)
        self.assertFalse(
            check_collusion_between_accounts(self.student, self.student2, threshold=3)
        )

    def test_at_threshold_flagged_and_audit_logged(self):
        for i in range(3):
            self._make_match_pair(self.student, self.student2, i)
        flagged = check_collusion_between_accounts(self.student, self.student2, threshold=3)
        self.assertTrue(flagged)
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.student,
                action='RECURRING_ACCOUNT_PAIR_FLAGGED',
            ).exists()
        )

    def test_same_user_both_sides_not_flagged(self):
        self.assertFalse(
            check_collusion_between_accounts(self.student, self.student, threshold=1)
        )

    def test_bidirectional_matches_counted(self):
        """Matches in both directions count toward threshold."""
        self._make_match_pair(self.student, self.student2, 0)   # A-lost B-found
        self._make_match_pair(self.student2, self.student, 1)   # B-lost A-found
        self._make_match_pair(self.student2, self.student, 2)
        flagged = check_collusion_between_accounts(self.student, self.student2, threshold=3)
        self.assertTrue(flagged)


# ===========================================================================
# H. MatchSerializer is_self_match field
# ===========================================================================

class MatchSerializerSelfMatchFieldTests(FraudBaseFixture):

    def _make_match(self, lost, found, self_match=False):
        return Match.objects.create(
            public_id=str(uuid.uuid4()),
            lost_item=lost,
            found_item=found,
            score=70,
            score_breakdown={'self_match': True} if self_match else {},
            matching_algorithm_version='v1',
            status=MatchStatus.CANDIDATE,
        )

    def test_is_self_match_true_when_flagged(self):
        lost = self.make_lost(self.student)
        found = self.make_found(self.student)
        match = self._make_match(lost, found, self_match=True)
        self.assertTrue(MatchSerializer(match).data['is_self_match'])

    def test_is_self_match_false_when_not_flagged(self):
        lost = self.make_lost(self.student)
        found = self.make_found(self.student2)
        match = self._make_match(lost, found, self_match=False)
        self.assertFalse(MatchSerializer(match).data['is_self_match'])

    def test_is_self_match_false_when_breakdown_empty(self):
        lost = self.make_lost(self.student)
        found = self.make_found(self.student2)
        match = Match.objects.create(
            public_id=str(uuid.uuid4()),
            lost_item=lost,
            found_item=found,
            score=50,
            score_breakdown={},
            matching_algorithm_version='v1',
            status=MatchStatus.CANDIDATE,
        )
        self.assertFalse(MatchSerializer(match).data['is_self_match'])

    def test_is_self_match_field_in_meta_fields(self):
        self.assertIn('is_self_match', MatchSerializer.Meta.fields)
