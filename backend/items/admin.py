from django.contrib import admin
from .models import FoundItem, LostItem, ItemImage, Match

@admin.register(FoundItem)
class FoundItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'found_location', 'collection_point', 'status', 'risk_tier', 'is_published', 'created_at')
    list_filter = ('status', 'risk_tier', 'is_published', 'category')
    search_fields = ('title', 'description', 'serial_number', 'imei', 'found_location')
    readonly_fields = ('public_id', 'created_at', 'updated_at', 'published_at')

@admin.register(LostItem)
class LostItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'category', 'status', 'risk_tier', 'created_at')
    list_filter = ('status', 'risk_tier', 'category')
    search_fields = ('description', 'user__email', 'user__name')
    readonly_fields = ('public_id', 'created_at', 'updated_at')

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'lost_item', 'found_item', 'score', 'status', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('public_id', 'created_at', 'updated_at')

@admin.register(ItemImage)
class ItemImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'content_type', 'object_id', 'uploaded_at')

