from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token

from .serializers import UserSerializer, SignupSerializer, LoginSerializer

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
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data,
            }, status=status.HTTP_200_OK)
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

