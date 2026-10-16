from rest_framework import serializers
from django.contrib.auth import authenticate
from django.db.models import Q
from .models import User

class UserSerializer(serializers.ModelSerializer):
    college_email = serializers.EmailField(source='email', read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'public_id',
            'name',
            'email',
            'college_email',
            'personal_email',
            'mobile_number',
            'role',
            'is_active',
            'date_joined',
        ]
        read_only_fields = ['id', 'public_id', 'date_joined']

class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    mobile_number = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    personal_email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True)
    name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, default='student', required=False)

    def validate_email(self, value):
        if value:
            normalized = value.strip().lower()
            if User.objects.filter(email__iexact=normalized).exists():
                raise serializers.ValidationError('A user with this email already exists.')
            return normalized
        return None

    def validate_mobile_number(self, value):
        if value:
            import re
            cleaned = value.strip()
            digits_only = re.sub(r'[\s\-\(\)]', '', cleaned)
            if not re.match(r'^\+?[0-9]{7,15}$', digits_only):
                raise serializers.ValidationError('Please enter a valid phone number (7 to 15 digits).')
            if User.objects.filter(mobile_number=digits_only).exists():
                raise serializers.ValidationError('A user with this mobile number already exists.')
            return digits_only
        return None

    def validate_personal_email(self, value):
        if value:
            return value.strip().lower()
        return None

    def validate(self, attrs):
        email = attrs.get('email')
        mobile = attrs.get('mobile_number')
        if not email and not mobile:
            raise serializers.ValidationError('At least one usable identifier (email address or mobile number) is required.')

        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')
        if password_confirm and password != password_confirm:
            raise serializers.ValidationError('Passwords do not match.')

        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm', None)
        validated_data['role'] = 'student'  # Public signup is strictly student-only
        password = validated_data.pop('password')
        email = validated_data.pop('email', None)
        personal_email = validated_data.get('personal_email')
        if email and not personal_email:
            validated_data['personal_email'] = email
        user = User.objects.create_user(email=email, password=password, **validated_data)
        return user

def find_user_by_identifier(identifier: str):
    """
    Find user by email, personal_email, or mobile number with normalization:
    - Case-insensitive email and personal_email matching
    - Mobile matching with whitespace/dash/parentheses stripping
    - Handles variations with or without country code (+91, 91, 0) and 10-digit suffixes
    """
    if not identifier:
        return None
    cleaned = identifier.strip()
    import re
    phone_candidates = {cleaned}
    if any(c.isdigit() for c in cleaned):
        digits_only = re.sub(r'[\s\-\(\)]', '', cleaned)
        phone_candidates.add(digits_only)
        phone_candidates.add(digits_only.lstrip('0'))
        if digits_only.startswith('+91'):
            phone_candidates.add(digits_only[3:])
            phone_candidates.add('91' + digits_only[3:])
        elif digits_only.startswith('91') and len(digits_only) > 10:
            phone_candidates.add(digits_only[2:])
            phone_candidates.add('+' + digits_only)
        elif len(digits_only) == 10:
            phone_candidates.add('+91' + digits_only)
            phone_candidates.add('91' + digits_only)
        if len(digits_only) >= 10:
            phone_candidates.add(digits_only[-10:])

    return User.objects.filter(
        Q(email__iexact=cleaned)
        | Q(personal_email__iexact=cleaned)
        | Q(mobile_number__in=phone_candidates)
    ).first()

class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(help_text="Email or mobile number")
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs.get('identifier', '').strip()
        password = attrs.get('password', '')

        if not identifier or not password:
            raise serializers.ValidationError('Both identifier and password are required.')

        user = find_user_by_identifier(identifier)

        if not user or not user.check_password(password):
            raise serializers.ValidationError('Invalid email/mobile number or password.')

        if not user.is_active:
            raise serializers.ValidationError('This user account is inactive.')

        attrs['user'] = user
        return attrs

class PasswordResetRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(help_text="Registered email or mobile number")

    def validate_identifier(self, value):
        return value.strip()

class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=6)
    new_password_confirm = serializers.CharField(write_only=True, min_length=6)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'Passwords do not match.'})
        return attrs
