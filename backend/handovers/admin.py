from django.contrib import admin
from .models import Handover

@admin.register(Handover)
class HandoverAdmin(admin.ModelAdmin):
    list_display = ('public_id', 'found_item', 'student', 'custodian', 'is_valuable', 'status', 'confirmed_at')
    list_filter = ('status', 'is_valuable')
    search_fields = ('public_id', 'student__email', 'found_item__title')
    readonly_fields = ('public_id', 'created_at', 'updated_at', 'confirmed_at', 'otp_hash')
