from django.contrib import admin
from .models import CollectionPoint

@admin.register(CollectionPoint)
class CollectionPointAdmin(admin.ModelAdmin):
    list_display = ('station_code', 'building', 'floor', 'station_type', 'status', 'zone')
    list_filter = ('status', 'building', 'station_type')
    search_fields = ('station_code', 'building', 'zone', 'directions')
    readonly_fields = ('public_id', 'created_at', 'updated_at')

