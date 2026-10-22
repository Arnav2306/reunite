import secrets
import string
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.exceptions import ValidationError
from .models import Handover, HandoverStatus

MAX_OTP_ATTEMPTS = 5

def get_otp_expiry_minutes() -> int:
    return int(getattr(settings, 'VALUABLE_PICKUP_OTP_EXPIRY_MINUTES', 15))

def generate_otp(handover: Handover) -> str:
    """
    Generates a cryptographically secure 6-digit OTP code, computes its hash using Django's
    make_password, sets configurable short expiry, updates handover status, and returns
    the plaintext OTP code once for immediate verified delivery.
    The plaintext OTP is NEVER saved in the database.
    """
    otp_code = ''.join(secrets.choice(string.digits) for _ in range(6))
    expiry_minutes = get_otp_expiry_minutes()
    handover.otp_hash = make_password(otp_code)
    handover.otp_expires_at = timezone.now() + timedelta(minutes=expiry_minutes)
    handover.otp_used = False
    handover.failed_otp_attempts = 0
    handover.status = HandoverStatus.PENDING_OTP
    handover.save()
    return otp_code

def regenerate_otp(handover: Handover, requested_by=None) -> str:
    """
    Safely regenerates a secure OTP for a valuable-item handover:
    - Invalidate previous OTP codes and resets attempt counter
    - Enforces ownership & valuable-item policy
    - Checks for open disputes before issuing a code
    - Delivers new OTP code only through verified in-app notification
    - Logs an audit event for accountability
    """
    if not handover.is_valuable:
        raise ValidationError({'detail': 'OTP regeneration is only applicable for valuable items.'})

    if handover.status == HandoverStatus.COMPLETED or handover.otp_used:
        raise ValidationError({'detail': 'Cannot regenerate OTP: handover has already been completed.'})

    # Block regeneration if there is an active dispute
    from pickup.models import Dispute, DisputeStatus
    open_dispute = Dispute.objects.filter(
        found_item=handover.found_item,
        status__in=[DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW, DisputeStatus.INFO_REQUESTED]
    ).first()
    if open_dispute:
        raise ValidationError({
            'detail': f'Cannot regenerate OTP: an active dispute ({open_dispute.public_id}) is currently pending on this item. Resolve disputes before pickup.'
        })

    otp_code = generate_otp(handover)
    expiry_minutes = get_otp_expiry_minutes()

    from audit.models import AuditLog
    actor = requested_by if (requested_by and requested_by.is_authenticated) else handover.student
    AuditLog.objects.create(
        actor=actor,
        action='OTP_REGENERATED',
        target_type='Handover',
        target_id=str(handover.public_id),
        details={
            'item_title': handover.found_item.title,
            'student_email': handover.student.email,
            'expiry_minutes': expiry_minutes,
        }
    )

    from notifications.models import Notification
    Notification.objects.create(
        user=handover.student,
        title='New Secure Pickup OTP',
        message=(
            f"Your regenerated secure pickup OTP for '{handover.found_item.title}' is: {otp_code} "
            f"(Valid for {expiry_minutes} minutes). Present this at the custodial collection desk with your student ID."
        ),
        notification_type='OTP_DELIVERED'
    )

    return otp_code

def verify_otp(handover: Handover, submitted_otp: str) -> bool:
    """
    Verifies a submitted 6-digit OTP code against the hashed OTP.
    Enforces expiration, attempt limits, and single-use constraints.
    """
    if handover.status == HandoverStatus.COMPLETED or handover.otp_used:
        raise ValidationError({'otp': 'This OTP has already been used and the handover is completed.'})

    if handover.failed_otp_attempts >= MAX_OTP_ATTEMPTS:
        handover.status = HandoverStatus.FAILED
        handover.save(update_fields=['status'])
        raise ValidationError({'otp': f'Maximum OTP verification attempts ({MAX_OTP_ATTEMPTS}) exceeded. Handover locked.'})

    if handover.otp_expires_at and timezone.now() > handover.otp_expires_at:
        raise ValidationError({'otp': 'OTP code has expired. Please request a new verification code.'})

    if not check_password(submitted_otp, handover.otp_hash):
        handover.failed_otp_attempts += 1
        if handover.failed_otp_attempts >= MAX_OTP_ATTEMPTS:
            handover.status = HandoverStatus.FAILED
            handover.save(update_fields=['failed_otp_attempts', 'status'])
            raise ValidationError({'otp': f'Maximum OTP verification attempts ({MAX_OTP_ATTEMPTS}) exceeded. Handover locked.'})
        handover.save(update_fields=['failed_otp_attempts'])
        remaining = MAX_OTP_ATTEMPTS - handover.failed_otp_attempts
        raise ValidationError({'otp': f'Invalid OTP code. {remaining} attempt(s) remaining.'})

    return True
