from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token

from .serializers import UserSerializer, SignupSerializer, LoginSerializer, StaffUserSerializer, AdminCreateUserSerializer
from .permissions import IsAdmin
from .models import User
from audit.models import AuditLog

class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Support either identifier or email/username
        data = request.data.copy()
        if 'identifier' not in data:
            if 'email' in data:
                data['identifier'] = data['email']
            elif 'username' in data:
                data['identifier'] = data['username']
            elif 'mobile_number' in data:
                data['identifier'] = data['mobile_number']

        serializer = LoginSerializer(data=data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            portal = data.get('portal')
            if portal == 'admin':
                if getattr(user, 'role', '') not in ['custodian', 'admin', 'superadmin'] and not getattr(user, 'is_staff', False):
                    return Response({
                        'detail': 'Access denied: student accounts cannot sign in through the Admin Portal. Please use the Student Portal.'
                    }, status=status.HTTP_403_FORBIDDEN)

            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data,
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AdminUserManagementView(APIView):
    """
    Dedicated staff user management for Admin and Super Admin.
    - GET: List staff users (Admins, Custodians).
    - POST: Provision staff accounts (Admin accounts can ONLY be created by Super Admin).
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        role_param = request.query_params.get('role')
        qs = User.objects.all().order_by('-date_joined')
        if role_param and role_param != 'all':
            qs = qs.filter(role=role_param)
        else:
            # By default list staff / operational accounts
            qs = qs.filter(role__in=['admin', 'superadmin', 'custodian'])

        serializer = StaffUserSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        role_to_create = request.data.get('role')
        caller = request.user
        is_superadmin = (getattr(caller, 'role', '') == 'superadmin' or getattr(caller, 'is_superuser', False))

        if role_to_create == 'admin' and not is_superadmin:
            return Response({
                'detail': 'Permission denied: only Super Admins can create Admin accounts.'
            }, status=status.HTTP_403_FORBIDDEN)

        if role_to_create not in ['admin', 'custodian']:
            return Response({
                'detail': 'Invalid role. Only admin or custodian accounts can be created through this interface.'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = AdminCreateUserSerializer(data=request.data)
        if serializer.is_valid():
            new_user = serializer.save()
            try:
                AuditLog.objects.create(
                    actor=caller,
                    action='STAFF_USER_CREATED',
                    target_type='User',
                    target_id=str(new_user.public_id),
                    details={
                        'created_role': new_user.role,
                        'created_email': new_user.email,
                        'created_name': new_user.name,
                        'created_by': caller.email,
                    }
                )
            except Exception:
                pass

            return Response(StaffUserSerializer(new_user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        """
        Allow authenticated users to update their own profile fields:
        - name
        - mobile_number (must be unique)
        - personal_email
        Role and email (primary identifier) cannot be changed here.
        """
        from django.db.models import Q
        user = request.user
        data = request.data

        # name
        if 'name' in data:
            name = str(data['name']).strip()
            if not name:
                return Response({'detail': 'Name cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
            user.name = name

        # mobile_number — enforce uniqueness
        if 'mobile_number' in data:
            mobile = str(data['mobile_number']).strip() if data['mobile_number'] else None
            if mobile:
                conflict = type(user).objects.filter(mobile_number=mobile).exclude(pk=user.pk).exists()
                if conflict:
                    return Response({'detail': 'This mobile number is already registered.'}, status=status.HTTP_400_BAD_REQUEST)
            user.mobile_number = mobile or None

        # personal_email
        if 'personal_email' in data:
            pe = str(data['personal_email']).strip() if data['personal_email'] else None
            user.personal_email = pe or None

        user.save(update_fields=['name', 'mobile_number', 'personal_email'])
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            Token.objects.filter(user=request.user).delete()
        except Exception:
            pass
        return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)

    def get(self, request):
        return self.post(request)

class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import PasswordResetRequestSerializer, find_user_by_identifier
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from django.conf import settings

        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            identifier = serializer.validated_data['identifier']
            user = find_user_by_identifier(identifier)
            resp_data = {'detail': 'If an account matches that identifier, password reset instructions have been generated.'}
            if user:
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                recipient = user.email or user.personal_email
                if recipient:
                    from django.core.mail import send_mail
                    try:
                        send_mail(
                            subject='REUNITE — Password Reset Request',
                            message=f'Hello {user.name},\n\nUse the following token to reset your password:\nUID: {uid}\nToken: {token}\n\nIf you did not request this, please ignore this email.',
                            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@reunite.edu'),
                            recipient_list=[recipient],
                            fail_silently=True,
                        )
                    except Exception:
                        pass
                import sys
                if getattr(settings, 'DEBUG', False) or 'test' in sys.argv:
                    resp_data['debug_uid'] = uid
                    resp_data['debug_token'] = token
            return Response(resp_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import PasswordResetConfirmSerializer
        from .models import User
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_decode
        from django.utils.encoding import force_str

        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            uid_b64 = serializer.validated_data['uid']
            token = serializer.validated_data['token']
            new_password = serializer.validated_data['new_password']
            try:
                uid = force_str(urlsafe_base64_decode(uid_b64))
                user = User.objects.get(pk=uid)
            except (TypeError, ValueError, OverflowError, User.DoesNotExist):
                return Response({'detail': 'Invalid or expired reset link.'}, status=status.HTTP_400_BAD_REQUEST)

            if not default_token_generator.check_token(user, token):
                return Response({'detail': 'Invalid or expired reset token.'}, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(new_password)
            user.save(update_fields=['password'])
            return Response({'detail': 'Password has been reset successfully. You can now sign in.'}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

