from django.contrib import admin
from .models import Claim, OwnershipVerification, PickupRequest, Dispute

@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = ('public_id', 'student', 'found_item', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('public_id', 'student__email', 'found_item__title')
    readonly_fields = ('public_id', 'created_at', 'updated_at')

@admin.register(OwnershipVerification)
class OwnershipVerificationAdmin(admin.ModelAdmin):
    list_display = ('public_id', 'claim', 'submission_timestamp')
    readonly_fields = ('public_id', 'submission_timestamp')

@admin.register(PickupRequest)
class PickupRequestAdmin(admin.ModelAdmin):
    list_display = ('public_id', 'claim', 'status', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('public_id', 'created_at', 'updated_at')

@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ('public_id', 'reporter', 'status', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('public_id', 'created_at', 'updated_at')
