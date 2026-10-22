"""
Fraud Prevention and Integrity Services for Reunite.
Provides server-side rate-limiting, duplicate report detection, image reuse detection,
self-matching prevention, and collusion review signals.
"""

import hashlib
import datetime
import re
from django.utils import timezone
from django.db.models import Q

from audit.models import AuditLog
from items.models import LostItem, FoundItem, ItemStatus, Match
from pickup.models import Claim, ClaimStatus


def _tokenize(text: str) -> set:
    if not text:
        return set()
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower())
    stop_words = {'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'and', 'or', 'my', 'some'}
    return {w for w in cleaned.split() if len(w) > 1 and w not in stop_words}


def calculate_file_hash(file_obj) -> str:
    """Computes SHA-256 hash of a file object and rewinds pointer."""
    hasher = hashlib.sha256()
    try:
        file_obj.seek(0)
        for chunk in file_obj.chunks() if hasattr(file_obj, 'chunks') else iter(lambda: file_obj.read(4096), b''):
            hasher.update(chunk)
        file_obj.seek(0)
    except Exception:
        return ''
    return hasher.hexdigest()


def check_report_rate_limit(user, report_type='lost', limit=5, window_minutes=15) -> tuple[bool, int]:
    """
    Checks if a user exceeded submission rate limit for reports in the given window.
    Returns (is_limited, current_count).
    Logs an AuditLog if rate limit is exceeded.
    """
    cutoff = timezone.now() - datetime.timedelta(minutes=window_minutes)
    if report_type == 'lost':
        count = LostItem.objects.filter(user=user, created_at__gte=cutoff).count()
    else:
        count = FoundItem.objects.filter(user=user, created_at__gte=cutoff).count()

    if count >= limit:
        AuditLog.objects.create(
            actor=user,
            action='REPORT_RATE_LIMIT_EXCEEDED',
            target_type='LostItem' if report_type == 'lost' else 'FoundItem',
            target_id=str(user.pk),
            details={
                'report_type': report_type,
                'count_in_window': count,
                'window_minutes': window_minutes,
                'limit': limit,
            }
        )
        return True, count

    return False, count


def detect_duplicate_report(user, category: str, description: str, model_class=LostItem, window_hours=24):
    """
    Detects potential duplicate reports submitted by the same user or other users.
    Returns: (is_user_duplicate, matched_item, reason, is_review_signal_only)
    """
    cutoff = timezone.now() - datetime.timedelta(hours=window_hours)
    norm_cat = (category or '').strip().lower()
    in_tokens = _tokenize(description or '')

    # 1. Check exact/near duplicate from the SAME user
    user_active_reports = model_class.objects.filter(
        user=user,
        created_at__gte=cutoff
    ).exclude(status__in=[ItemStatus.RESOLVED, ItemStatus.CANCELLED])

    for item in user_active_reports:
        item_cat = (item.category or '').strip().lower()
        if item_cat == norm_cat:
            item_tokens = _tokenize(item.description or '')
            if in_tokens and item_tokens:
                overlap = len(in_tokens.intersection(item_tokens))
                union = len(in_tokens.union(item_tokens))
                jaccard = overlap / union if union > 0 else 0.0
                if jaccard >= 0.8:
                    return True, item, f"Duplicate active {item_cat} report already submitted by you.", False
            elif (description or '').strip().lower() == (item.description or '').strip().lower():
                return True, item, f"Duplicate active {item_cat} report already submitted by you.", False

    # 2. Check cross-user near-identical reports (Review signal only)
    cross_reports = model_class.objects.filter(
        created_at__gte=cutoff
    ).exclude(user=user).exclude(status__in=[ItemStatus.RESOLVED, ItemStatus.CANCELLED])

    for item in cross_reports:
        item_cat = (item.category or '').strip().lower()
        if item_cat == norm_cat:
            item_tokens = _tokenize(item.description or '')
            if in_tokens and item_tokens:
                overlap = len(in_tokens.intersection(item_tokens))
                union = len(in_tokens.union(item_tokens))
                jaccard = overlap / union if union > 0 else 0.0
                if jaccard >= 0.85:
                    return False, item, "Highly similar report submitted by another user recently.", True

    return False, None, "", False


def detect_and_record_image_upload(image_file, user, target_type: str, target_id: str) -> bool:
    """
    Computes image hash, records image upload in AuditLog, and flags if image
    was previously uploaded by a different account (collusion / image reuse signal).
    Returns True if suspicious cross-account image reuse was detected.
    """
    img_hash = calculate_file_hash(image_file)
    if not img_hash:
        return False

    # Check if this exact image hash was previously uploaded by a DIFFERENT user
    previous_upload = AuditLog.objects.filter(
        action='IMAGE_UPLOAD_RECORDED',
        details__image_hash=img_hash
    ).exclude(actor=user).first()

    reused = False
    if previous_upload:
        reused = True
        AuditLog.objects.create(
            actor=user,
            action='SUSPICIOUS_IMAGE_REUSE_FLAGGED',
            target_type=target_type,
            target_id=target_id,
            details={
                'image_hash': img_hash,
                'original_actor_id': str(previous_upload.actor.pk) if previous_upload.actor else None,
                'original_actor_email': previous_upload.actor.email if previous_upload.actor else None,
                'original_target_id': previous_upload.target_id,
                'review_signal': True,
                'reason': 'Same item photograph reused across different student accounts',
            }
        )

    # Record current upload for future collusion auditing
    AuditLog.objects.create(
        actor=user,
        action='IMAGE_UPLOAD_RECORDED',
        target_type=target_type,
        target_id=target_id,
        details={
            'image_hash': img_hash,
            'user_id': str(user.pk),
        }
    )

    return reused


def check_collusion_between_accounts(user_a, user_b, threshold=3) -> bool:
    """
    Flags recurring matches or claims between two specific user accounts.
    Returns True if suspicious pattern detected and logs review signal.
    """
    if not user_a or not user_b or user_a == user_b:
        return False

    matches_count = Match.objects.filter(
        (Q(lost_item__user=user_a, found_item__user=user_b) |
         Q(lost_item__user=user_b, found_item__user=user_a))
    ).count()

    if matches_count >= threshold:
        AuditLog.objects.create(
            actor=user_a,
            action='RECURRING_ACCOUNT_PAIR_FLAGGED',
            target_type='User',
            target_id=str(user_a.pk),
            details={
                'user_a_email': user_a.email,
                'user_b_email': user_b.email,
                'matches_count': matches_count,
                'threshold': threshold,
                'review_signal': True,
                'reason': 'Recurring high volume of matches between these two student accounts',
            }
        )
        return True

    return False


def check_questionable_claim_history(student) -> bool:
    """
    Flags review signal if student has multiple rejected claims or suspicious claim history.
    """
    rejected_count = Claim.objects.filter(student=student, status=ClaimStatus.REJECTED).count()
    if rejected_count >= 2:
        AuditLog.objects.create(
            actor=student,
            action='QUESTIONABLE_CLAIM_HISTORY_FLAGGED',
            target_type='User',
            target_id=str(student.pk),
            details={
                'student_email': student.email,
                'rejected_claims_count': rejected_count,
                'review_signal': True,
                'reason': 'Student has multiple previously rejected claims',
            }
        )
        return True

    return False
