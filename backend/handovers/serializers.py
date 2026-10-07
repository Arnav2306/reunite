from rest_framework import serializers
from .models import Handover
from items.serializers import AvailableItemPublicSerializer, FoundItemAdminSerializer
from accounts.serializers import UserSerializer

class HandoverSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    custodian = UserSerializer(read_only=True)
    found_item = AvailableItemPublicSerializer(read_only=True)

    class Meta:
        model = Handover
        fields = [
            'public_id',
            'found_item',
            'student',
            'custodian',
            'is_valuable',
            'otp_expires_at',
            'otp_used',
            'failed_otp_attempts',
            'status',
            'confirmed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

class HandoverStaffDetailSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    custodian = UserSerializer(read_only=True)
    found_item = FoundItemAdminSerializer(read_only=True)

    class Meta:
        model = Handover
        fields = [
            'public_id',
            'found_item',
            'student',
            'custodian',
            'is_valuable',
            'otp_expires_at',
            'otp_used',
            'failed_otp_attempts',
            'status',
            'confirmed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields
