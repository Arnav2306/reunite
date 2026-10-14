import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class ClaimStatus(models.TextChoices):
    PENDING = 'PENDING', _('Pending')
    APPROVED = 'APPROVED', _('Approved')
    REJECTED = 'REJECTED', _('Rejected')
    CANCELLED = 'CANCELLED', _('Cancelled')

class Claim(models.Model):
    public_id = models.CharField(max_length=36, default=uuid.uuid4, editable=False, unique=True)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='claims'
    )
    found_item = models.ForeignKey(
        'items.FoundItem',
        on_delete=models.CASCADE,
        related_name='claims'
    )
    status = models.CharField(
        max_length=30,
        choices=ClaimStatus.choices,
        default=ClaimStatus.PENDING
    )
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'found_item'],
                condition=models.Q(status__in=['PENDING', 'APPROVED']),
                name='unique_active_claim_per_student_item'
            )
        ]

    def __str__(self):
        return f"Claim {self.public_id} by {self.student.email} for {self.found_item}"

class VerificationResult(models.TextChoices):
    PENDING = 'PENDING', _('Pending')
    VERIFIED = 'VERIFIED', _('Verified')
    FAILED = 'FAILED', _('Failed')

class OwnershipVerification(models.Model):
    public_id = models.CharField(max_length=36, default=uuid.uuid4, editable=False, unique=True)
    claim = models.OneToOneField(
        Claim,
        on_delete=models.CASCADE,
        related_name='verification'
    )
    question = models.TextField()
    student_answer = models.TextField()
    verification_result = models.CharField(
        max_length=30,
        choices=VerificationResult.choices,
        default=VerificationResult.PENDING
    )
    submission_timestamp = models.DateTimeField(auto_now_add=True)
    version = models.CharField(max_length=20, default='v1.0')

    def __str__(self):
        return f"Verification for Claim {self.claim.public_id}"

class PickupRequest(models.Model):
    """
    Request for a user to pick up an item.
    Status workflow follows ItemStatus enum defined in items.models.
    """
    public_id = models.CharField(max_length=36, default=uuid.uuid4, editable=False, unique=True)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pickup_requests'
    )
    claim = models.ForeignKey(
        Claim,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='pickup_requests'
    )
    collection_point = models.ForeignKey(
        'collectionpoint.CollectionPoint',
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    # Generic relation to either LostItem or FoundItem
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    item = GenericForeignKey('content_type', 'object_id')
    status = models.CharField(max_length=30, default='READY_FOR_PICKUP')
    pickup_instructions = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('pickup request')
        verbose_name_plural = _('pickup requests')

    def __str__(self):
        return f"PickupRequest {self.public_id} by {self.requester.email}"


class DisputeReason(models.TextChoices):
    NOT_MINE = 'NOT_MINE', _('Item is not mine')
    INCORRECT_INFO = 'INCORRECT_INFO', _('Incorrect information')
    DAMAGED = 'DAMAGED', _('Item appears damaged')
    ANOTHER_CLAIMING = 'ANOTHER_CLAIMING', _('Another person is claiming it')
    OTHER = 'OTHER', _('Other issue')


class DisputeStatus(models.TextChoices):
    OPEN = 'OPEN', _('Open')
    UNDER_REVIEW = 'UNDER_REVIEW', _('Under Review')
    INFO_REQUESTED = 'INFO_REQUESTED', _('Information Requested')
    RESOLVED = 'RESOLVED', _('Resolved')
    REJECTED = 'REJECTED', _('Rejected')
    ESCALATED = 'ESCALATED', _('Escalated')


class Dispute(models.Model):
    public_id = models.CharField(max_length=36, default=uuid.uuid4, editable=False, unique=True)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='disputes'
    )
    claim = models.ForeignKey(
        Claim,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='disputes'
    )
    found_item = models.ForeignKey(
        'items.FoundItem',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='disputes'
    )
    reason = models.CharField(
        max_length=50,
        choices=DisputeReason.choices,
        default=DisputeReason.OTHER
    )
    description = models.TextField()
    status = models.CharField(
        max_length=30,
        choices=DisputeStatus.choices,
        default=DisputeStatus.OPEN
    )
    admin_response = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Dispute {self.public_id} ({self.reason}) by {self.reporter.email}"


class Feedback(models.Model):
    public_id = models.CharField(max_length=36, default=uuid.uuid4, editable=False, unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='feedbacks'
    )
    rating = models.IntegerField(choices=[(i, str(i)) for i in range(1, 6)])
    comment = models.TextField(blank=True)
    claim = models.ForeignKey(
        Claim,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='feedbacks'
    )
    found_item = models.ForeignKey(
        'items.FoundItem',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='feedbacks'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Feedback {self.rating}/5 by {self.user.email}"

