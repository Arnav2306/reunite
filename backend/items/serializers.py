from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from .models import FoundItem, LostItem, ItemImage, Listing, ItemStatus, Match
from collectionpoint.models import CollectionPoint

class ItemImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ItemImage
        fields = ['id', 'image', 'image_url', 'uploaded_at']

    def get_image_url(self, obj):
        if not obj.image:
            return None
        name = obj.image.name or ''
        # If the stored name is already an absolute URL (some storage backends
        # store the full URL), return it directly.
        if name.startswith('http://') or name.startswith('https://'):
            return name

        storage = getattr(obj.image, 'storage', None)
        storage_name = storage.__class__.__name__ if storage else ''

        # Build a direct Cloudinary delivery URL from the public_id (stored name)
        # when Cloudinary storage is active, ensuring legacy and prefixed keys resolve.
        if 'Cloudinary' in storage_name:
            try:
                import cloudinary
                resource = cloudinary.CloudinaryResource(
                    name, default_resource_type='image'
                )
                return resource.build_url(secure=True)
            except Exception:
                pass

        # Fallback (or local FileSystemStorage): use storage.url()
        request = self.context.get('request')
        try:
            url = obj.image.url
        except Exception:
            return None
        if request is not None and not (url.startswith('http://') or url.startswith('https://')):
            return request.build_absolute_uri(url)
        return url

class CollectionPointSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollectionPoint
        fields = [
            'id', 'public_id', 'station_code', 'building',
            'floor', 'station_type', 'status', 'zone'
        ]

class FoundItemAdminSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()
    collection_point_details = CollectionPointSimpleSerializer(source='collection_point', read_only=True)
    registered_by_name = serializers.CharField(source='user.name', read_only=True)
    registered_by_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = FoundItem
        fields = [
            'id',
            'public_id',
            'title',
            'category',
            'description',
            'found_date',
            'found_location',
            'finder',
            'source',
            'collection_point',
            'collection_point_details',
            'status',
            'risk_tier',
            'cannot_carry',
            'cannot_carry_details',
            'is_published',
            'published_at',
            # Private identification & verification fields (Admin/Custodian only)
            'serial_number',
            'imei',
            'identifying_marks',
            'internal_notes',
            'secret_verification_info',
            'ai_metadata',
            'student_corrections',
            'unclaimed_stage',
            'disposition_type',
            'disposition_notes',
            'disposition_date',
            'images',
            'registered_by_name',
            'registered_by_email',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'public_id', 'created_at', 'updated_at', 'published_at']

    def validate_collection_point(self, value):
        if value and getattr(value, 'status', None) != 'ACTIVE':
            raise serializers.ValidationError("Unavailable stations cannot be selected for a deposit.")
        return value

    def get_images(self, obj):
        content_type = ContentType.objects.get_for_model(FoundItem)
        images = ItemImage.objects.filter(content_type=content_type, object_id=obj.id)
        return ItemImageSerializer(images, many=True, context=self.context).data

class AvailableItemPublicSerializer(serializers.ModelSerializer):
    """
    STRICT Public Serializer for Students and Public Catalog.
    Strictly excludes serial_number, imei, identifying_marks, internal_notes, and secret_verification_info.
    """
    images = serializers.SerializerMethodField()
    collection_location = CollectionPointSimpleSerializer(source='collection_point', read_only=True)

    class Meta:
        model = FoundItem
        fields = [
            'id',
            'public_id',
            'title',
            'category',
            'description',
            'found_date',
            'found_location',
            'collection_location',
            'status',
            'risk_tier',
            'cannot_carry',
            'cannot_carry_details',
            'is_published',
            'published_at',
            'images',
            'created_at',
        ]
        read_only_fields = fields

    def get_images(self, obj):
        content_type = ContentType.objects.get_for_model(FoundItem)
        images = ItemImage.objects.filter(content_type=content_type, object_id=obj.id)
        return ItemImageSerializer(images, many=True, context=self.context).data


class LostItemSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    matches_count = serializers.SerializerMethodField()

    class Meta:
        model = LostItem
        fields = [
            'id',
            'public_id',
            'category',
            'description',
            'original_answers',
            'normalized_attributes',
            'status',
            'risk_tier',
            'images',
            'matches_count',
            'user_name',
            'user_email',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'public_id', 'status', 'created_at', 'updated_at', 'matches_count']

    def get_images(self, obj):
        content_type = ContentType.objects.get_for_model(LostItem)
        images = ItemImage.objects.filter(content_type=content_type, object_id=obj.id)
        return ItemImageSerializer(images, many=True, context=self.context).data

    def get_matches_count(self, obj):
        return obj.matches.count()


class MatchSerializer(serializers.ModelSerializer):
    """
    Serializer for match candidates shown to the student.
    Strictly nests FoundItem using AvailableItemPublicSerializer to ensure NO private fields leak.
    """
    found_item = AvailableItemPublicSerializer(read_only=True)
    label = serializers.SerializerMethodField()
    lost_item_id = serializers.IntegerField(source='lost_item.id', read_only=True)
    lost_item_public_id = serializers.CharField(source='lost_item.public_id', read_only=True)
    lost_item_category = serializers.CharField(source='lost_item.category', read_only=True)
    lost_item_description = serializers.CharField(source='lost_item.description', read_only=True)

    class Meta:
        model = Match
        fields = [
            'id',
            'public_id',
            'lost_item_id',
            'lost_item_public_id',
            'lost_item_category',
            'lost_item_description',
            'found_item',
            'score',
            'label',
            'score_breakdown',
            'status',
            'matching_algorithm_version',
            'scoring_version',
            'user_feedback',
            'feedback_notes',
            'feedback_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_label(self, obj):
        from .services.matching import get_match_label
        return get_match_label(obj.score)


class StudentFoundItemSerializer(serializers.ModelSerializer):
    """
    Serializer for student-submitted found item reports.
    Accepts only safe public fields. Private verification fields are NOT accepted from students.
    Students can report category, title, description, found_date, found_location, and collection_point.
    """
    images = serializers.SerializerMethodField()
    collection_point_details = CollectionPointSimpleSerializer(source='collection_point', read_only=True)
    submitted_by_name = serializers.CharField(source='user.name', read_only=True)

    class Meta:
        model = FoundItem
        fields = [
            'id',
            'public_id',
            'title',
            'category',
            'description',
            'found_date',
            'found_location',
            'collection_point',
            'collection_point_details',
            'risk_tier',
            'cannot_carry',
            'cannot_carry_details',
            'ai_metadata',
            'student_corrections',
            'is_published',
            'status',
            'source',
            'images',
            'submitted_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'public_id', 'is_published', 'status', 'source', 'created_at', 'updated_at']

    def validate_collection_point(self, value):
        if value and getattr(value, 'status', None) != 'ACTIVE':
            raise serializers.ValidationError("Unavailable stations cannot be selected for a deposit.")
        return value

    def get_images(self, obj):
        content_type = ContentType.objects.get_for_model(FoundItem)
        images = ItemImage.objects.filter(content_type=content_type, object_id=obj.id)
        return ItemImageSerializer(images, many=True, context=self.context).data
