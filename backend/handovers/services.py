import secrets
import string
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.exceptions import ValidationError
from .models import Handover, HandoverStatus

MAX_OTP_ATTEMPTS = 5

def generate_otp(handover: Handover) -> str:
    """
    Generates a cryptographically secure 6-digit OTP code, computes its hash using Django's
    make_password, updates handover status, and returns the plaintext OTP code once.
    The plaintext OTP is NOT saved in the database.
    """
    otp_code = ''.join(secrets.choice(string.digits) for _ in range(6))
    handover.otp_hash = make_password(otp_code)
    handover.otp_expires_at = timezone.now() + timedelta(hours=24)
    handover.otp_used = False
    handover.failed_otp_attempts = 0
    handover.status = HandoverStatus.PENDING_OTP
    handover.save()
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
        handover.save()
        raise ValidationError({'otp': f'Maximum OTP verification attempts ({MAX_OTP_ATTEMPTS}) exceeded. Handover locked.'})

    if handover.otp_expires_at and timezone.now() > handover.otp_expires_at:
        raise ValidationError({'otp': 'OTP code has expired. Please request a new verification code.'})

    if not check_password(submitted_otp, handover.otp_hash):
        handover.failed_otp_attempts += 1
        if handover.failed_otp_attempts >= MAX_OTP_ATTEMPTS:
            handover.status = HandoverStatus.FAILED
        handover.save()
        remaining = MAX_OTP_ATTEMPTS - handover.failed_otp_attempts
        raise ValidationError({'otp': f'Invalid OTP code. {remaining} attempt(s) remaining.'})

    return True
