import uuid
from django.db import models
from django.conf import settings

class Notification(models.Model):
    public_id = models.CharField(max_length=36, default=uuid.uuid4, editable=False, unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, default='INFO')
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # Deep-link: frontend route this notification should navigate to (e.g. '/matches')
    action_url = models.CharField(max_length=500, blank=True, default='')

    # Deduplication anchor: stores the public_id of the primary related object
    # (e.g. lost_item.public_id for MATCH_FOUND) to prevent duplicate notifications
    related_object_id = models.CharField(max_length=36, blank=True, default='', db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'

    def __str__(self):
        return f"Notification for {self.user.email}: {self.title}"
