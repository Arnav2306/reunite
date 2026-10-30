from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _

User = get_user_model()

class ItemStatus(models.TextChoices):
    REPORTED = 'REPORTED', _('Reported')
    DEPOSIT_PENDING = 'DEPOSIT_PENDING', _('Deposit Pending')
    DEPOSITED = 'DEPOSITED', _('Deposited')
    COLLECTED = 'COLLECTED', _('Collected')
    SECURE_HOLD = 'SECURE_HOLD', _('Secure Hold')
    MATCH_FOUND = 'MATCH_FOUND', _('Match Found')
    VERIFICATION_PENDING = 'VERIFICATION_PENDING', _('Verification Pending')
    READY_FOR_PICKUP = 'READY_FOR_PICKUP', _('Ready For Pickup')
    HANDOVER = 'HANDOVER', _('Handover')
    RESOLVED = 'RESOLVED', _('Resolved')
    CANCELLED = 'CANCELLED', _('Cancelled')
    ARCHIVED = 'ARCHIVED', _('Archived')

import secrets

def generate_report_id(prefix: str) -> str:
    """
    Generates a unique, permanent, human-readable ID (e.g. RNT-L-7K4P9X, RNT-F-8M2Q6W).
    Uses un-ambiguous uppercase alphanumeric characters.
    """
    alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    code = ''.join(secrets.choice(alphabet) for _ in range(6))
    return f"{prefix}-{code}"

def generate_lost_id() -> str:
    while True:
        candidate = generate_report_id('RNT-L')
        if not LostItem.objects.filter(public_id=candidate).exists():
            return candidate

def generate_found_id() -> str:
    while True:
        candidate = generate_report_id('RNT-F')
        if not FoundItem.objects.filter(public_id=candidate).exists():
            return candidate

class LostItem(models.Model):
    public_id = models.CharField(max_length=36, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lost_items')
    category = models.CharField(max_length=100)
    description = models.TextField()
    original_answers = models.JSONField(default=dict, blank=True)
    normalized_attributes = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=30, choices=ItemStatus.choices, default=ItemStatus.REPORTED)
    risk_tier = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.pk:
            orig = LostItem.objects.filter(pk=self.pk).values('public_id').first()
            if orig and orig['public_id']:
                self.public_id = orig['public_id']
        elif not self.public_id:
            self.public_id = generate_lost_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"LostItem {self.public_id}"

class FoundItem(models.Model):
    public_id = models.CharField(max_length=36, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='found_items')
    title = models.CharField(max_length=200, default='')
    category = models.CharField(max_length=100)
    description = models.TextField()
    found_date = models.DateField(null=True, blank=True)
    found_location = models.CharField(max_length=200, blank=True)
    finder = models.CharField(max_length=100, blank=True)
    source = models.CharField(max_length=100, blank=True)
    collection_point = models.ForeignKey('collectionpoint.CollectionPoint', null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=30, choices=ItemStatus.choices, default=ItemStatus.REPORTED)
    risk_tier = models.IntegerField(default=0, help_text="0=General, 1=Valuable/High Risk")
    cannot_carry = models.BooleanField(default=False)
    cannot_carry_details = models.CharField(max_length=255, blank=True)
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)

    # Private Verification / Identification Fields (Only visible to Custodian / Admin)
    serial_number = models.CharField(max_length=100, blank=True)
    imei = models.CharField(max_length=50, blank=True)
    identifying_marks = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    secret_verification_info = models.TextField(blank=True)

    # AI Processing and Review Tracking
    ai_metadata = models.JSONField(default=dict, blank=True)
    student_corrections = models.JSONField(default=dict, blank=True)

    # Unclaimed Lifecycle & Administrative Disposition
    unclaimed_stage = models.CharField(max_length=50, blank=True, default='ACTIVE_RECOVERY')
    disposition_type = models.CharField(max_length=50, blank=True)
    disposition_notes = models.TextField(blank=True)
    disposition_date = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.pk:
            orig = FoundItem.objects.filter(pk=self.pk).values('public_id').first()
            if orig and orig['public_id']:
                self.public_id = orig['public_id']
        elif not self.public_id:
            self.public_id = generate_found_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"FoundItem {self.title or self.public_id}"

class Listing(models.Model):
    public_id = models.CharField(max_length=36, unique=True)
    item_content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    item_object_id = models.PositiveIntegerField()
    item = GenericForeignKey('item_content_type', 'item_object_id')
    published_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='listings')
    title = models.CharField(max_length=200)
    safe_description = models.TextField()
    collection_location = models.ForeignKey('collectionpoint.CollectionPoint', null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=30, choices=ItemStatus.choices, default=ItemStatus.REPORTED)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Listing {self.public_id}"

class ItemImage(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    image = models.ImageField(upload_to='item_images/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.content_object}"

class ItemEmbedding(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    vector = models.BinaryField(null=True, blank=True)  # placeholder for future pgvector
    model_version = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Embedding for {self.content_object}"

class MatchStatus(models.TextChoices):
    CANDIDATE = 'CANDIDATE', _('Candidate')
    REVIEWED = 'REVIEWED', _('Reviewed')
    DISMISSED = 'DISMISSED', _('Dismissed')
    CLAIMED = 'CLAIMED', _('Claimed')

class Match(models.Model):
    public_id = models.CharField(max_length=36, unique=True)
    lost_item = models.ForeignKey(LostItem, on_delete=models.CASCADE, related_name='matches')
    found_item = models.ForeignKey(FoundItem, on_delete=models.CASCADE, related_name='matches')
    score = models.IntegerField(help_text="Normalized match score 0-100")
    score_breakdown = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=30, choices=MatchStatus.choices, default=MatchStatus.CANDIDATE)
    matching_algorithm_version = models.CharField(max_length=20, default='v1.0')
    scoring_version = models.CharField(max_length=20, default='v1.0')
    user_feedback = models.BooleanField(null=True, blank=True, help_text="True if student confirmed match was correct, False otherwise")
    feedback_notes = models.TextField(blank=True)
    feedback_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-score', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['lost_item', 'found_item'],
                name='unique_lost_found_match'
            )
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            import uuid
            self.public_id = str(uuid.uuid4())
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Match {self.lost_item_id} <-> {self.found_item_id} ({self.score}/100)"

