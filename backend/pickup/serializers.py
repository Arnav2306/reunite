from rest_framework import serializers
from .models import Claim, OwnershipVerification, PickupRequest
from items.models import FoundItem
from items.serializers import AvailableItemPublicSerializer, FoundItemAdminSerializer
from accounts.serializers import UserSerializer
from handovers.serializers import HandoverSerializer, HandoverStaffDetailSerializer

class OwnershipVerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = OwnershipVerification
        fields = ['public_id', 'question', 'student_answer', 'verification_result', 'submission_timestamp', 'version']
        read_only_fields = ['public_id', 'submission_timestamp']

class ClaimStudentSerializer(serializers.ModelSerializer):
    found_item = AvailableItemPublicSerializer(read_only=True)
    verification = OwnershipVerificationSerializer(read_only=True)
    handover = HandoverSerializer(source='handover_record', read_only=True)

    class Meta:
        model = Claim
        fields = [
            'public_id',
            'found_item',
            'status',
            'verification',
            'handover',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

class ClaimAdminSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    found_item = FoundItemAdminSerializer(read_only=True)
    verification = OwnershipVerificationSerializer(read_only=True)
    handover = HandoverStaffDetailSerializer(source='handover_record', read_only=True)

    class Meta:
        model = Claim
        fields = [
            'public_id',
            'student',
            'found_item',
            'status',
            'admin_notes',
            'verification',
            'handover',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['public_id', 'student', 'found_item', 'verification', 'handover', 'created_at', 'updated_at']

class CreateClaimSerializer(serializers.Serializer):
    found_item_id = serializers.CharField(required=True)
    student_answer = serializers.CharField(required=True, allow_blank=False)

    def validate_found_item_id(self, value):
        try:
            item = FoundItem.objects.get(public_id=value, is_published=True)
        except FoundItem.DoesNotExist:
            raise serializers.ValidationError("Found item does not exist or is not published.")
        return item


class DisputeSerializer(serializers.ModelSerializer):
    reporter = UserSerializer(read_only=True)
    claim_public_id = serializers.CharField(write_only=True, required=False, allow_null=True)
    found_item_public_id = serializers.CharField(write_only=True, required=False, allow_null=True)
    claim = ClaimStudentSerializer(read_only=True)
    found_item = AvailableItemPublicSerializer(read_only=True)

    class Meta:
        from .models import Dispute
        model = Dispute
        fields = [
            'public_id',
            'reporter',
            'claim',
            'found_item',
            'claim_public_id',
            'found_item_public_id',
            'reason',
            'description',
            'status',
            'admin_response',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['public_id', 'reporter', 'claim', 'found_item', 'created_at', 'updated_at']

    def create(self, validated_data):
        from .models import Dispute, Claim
        from items.models import FoundItem
        claim_pid = validated_data.pop('claim_public_id', None)
        item_pid = validated_data.pop('found_item_public_id', None)

        claim = None
        found_item = None
        if claim_pid:
            claim = Claim.objects.filter(public_id=claim_pid).first()
            if claim and not found_item:
                found_item = claim.found_item
        if item_pid and not found_item:
            found_item = FoundItem.objects.filter(public_id=item_pid).first()

        validated_data['claim'] = claim
        validated_data['found_item'] = found_item
        return super().create(validated_data)


class FeedbackSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    claim_public_id = serializers.CharField(write_only=True, required=False, allow_null=True)
    found_item_public_id = serializers.CharField(write_only=True, required=False, allow_null=True)

    class Meta:
        from .models import Feedback
        model = Feedback
        fields = [
            'public_id',
            'user_name',
            'rating',
            'comment',
            'claim_public_id',
            'found_item_public_id',
            'created_at',
        ]
        read_only_fields = ['public_id', 'user_name', 'created_at']

    def create(self, validated_data):
        from .models import Feedback, Claim
        from items.models import FoundItem
        claim_pid = validated_data.pop('claim_public_id', None)
        item_pid = validated_data.pop('found_item_public_id', None)

        claim = None
        found_item = None
        if claim_pid:
            claim = Claim.objects.filter(public_id=claim_pid).first()
            if claim and not found_item:
                found_item = claim.found_item
        if item_pid and not found_item:
            found_item = FoundItem.objects.filter(public_id=item_pid).first()

        validated_data['claim'] = claim
        validated_data['found_item'] = found_item
        return super().create(validated_data)

