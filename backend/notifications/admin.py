from django.contrib import admin
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('public_id', 'user', 'title', 'notification_type', 'read', 'created_at')
    list_filter = ('notification_type', 'read')
    search_fields = ('user__email', 'title', 'message')
    readonly_fields = ('public_id', 'created_at')
