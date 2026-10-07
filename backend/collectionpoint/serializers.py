from rest_framework import serializers
import uuid
from .models import CollectionPoint

class CollectionPointSerializer(serializers.ModelSerializer):
    backup_station_details = serializers.SerializerMethodField()

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
            'backup_station',
            'backup_station_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'public_id', 'created_at', 'updated_at']

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
