import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _

class HandoverStatus(models.TextChoices):
    PENDING = 'PENDING', _('Pending')
    PENDING_OTP = 'PENDING_OTP', _('Pending OTP')
    READY = 'READY', _('Ready')
    COMPLETED = 'COMPLETED', _('Completed')
    FAILED = 'FAILED', _('Failed')

class Handover(models.Model):
    public_id = models.CharField(max_length=36, default=uuid.uuid4, editable=False, unique=True)
    pickup_request = models.OneToOneField('pickup.PickupRequest', on_delete=models.CASCADE, related_name='handover')
    found_item = models.ForeignKey('items.FoundItem', on_delete=models.CASCADE, related_name='handovers')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='handovers_received')
    custodian = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='handovers_performed')
    is_valuable = models.BooleanField(default=False)
    otp_hash = models.CharField(max_length=128, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)
    otp_used = models.BooleanField(default=False)
    failed_otp_attempts = models.IntegerField(default=0)
    status = models.CharField(max_length=30, choices=HandoverStatus.choices, default=HandoverStatus.READY)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Handover {self.public_id} - {self.status}"
