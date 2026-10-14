from rest_framework import serializers
import uuid
from .models import CollectionPoint, CampusConfig

class CollectionPointSerializer(serializers.ModelSerializer):
    backup_station_details = serializers.SerializerMethodField()
    current_count = serializers.SerializerMethodField()

    class Meta:
        model = CollectionPoint
        fields = [
            'id',
            'public_id',
            'station_code',
            'building',
            'floor',
            'station_type',
            'status',
            'capacity',
            'current_count',
            'zone',
            'opening_hours',
            'directions',
            'map_link',
            'backup_station',
            'backup_station_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'public_id', 'created_at', 'updated_at']

    def get_current_count(self, obj):
        from items.models import FoundItem, ItemStatus
        count = FoundItem.objects.filter(
            collection_point=obj,
            status__in=[ItemStatus.DEPOSITED, ItemStatus.SECURE_HOLD, ItemStatus.READY_FOR_PICKUP]
        ).count()
        return count or obj.current_count

    def get_backup_station_details(self, obj):
        if obj.backup_station:
            return {
                'id': obj.backup_station.id,
                'station_code': obj.backup_station.station_code,
                'building': obj.backup_station.building,
                'floor': obj.backup_station.floor,
                'status': obj.backup_station.status,
            }
        return None

    def create(self, validated_data):
        if 'public_id' not in validated_data:
            validated_data['public_id'] = str(uuid.uuid4())
        return super().create(validated_data)


class CampusConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampusConfig
        fields = [
            'id',
            'name',
            'address',
            'locality',
            'city',
            'state',
            'pin_code',
            'contact_email',
            'contact_phone',
            'website',
            'maps_link',
            'is_configured',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']
