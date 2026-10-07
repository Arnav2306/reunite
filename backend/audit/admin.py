from django.contrib import admin
from .models import AuditLog

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'action', 'actor', 'target_type', 'target_id', 'timestamp')
    list_filter = ('action', 'target_type')
    search_fields = ('actor__email', 'target_id', 'action')
    readonly_fields = ('timestamp',)
