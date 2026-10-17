from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'public_id', 'title', 'message', 'notification_type',
            'read', 'created_at', 'action_url', 'related_object_id',
        ]
        read_only_fields = [
            'public_id', 'title', 'message', 'notification_type',
            'created_at', 'action_url', 'related_object_id',
        ]
