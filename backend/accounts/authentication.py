from rest_framework.authentication import TokenAuthentication
from rest_framework import exceptions
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.backends import ModelBackend

class CaseInsensitiveIdentifierAuthBackend(ModelBackend):
    """
    Authenticate against settings.AUTH_USER_MODEL using case-insensitive
    admin_id, email, personal_email, or mobile number.
    Ensures seamless authentication for both Django Admin (/admin/) and standard auth flows.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        identifier = username or kwargs.get('identifier') or kwargs.get('admin_id')
        if not identifier or not password:
            return None
        from .serializers import find_user_by_identifier
        user = find_user_by_identifier(identifier)
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None


class BearerTokenAuthentication(TokenAuthentication):
    """
    Custom token authentication that accepts both 'Bearer <token>' and 'Token <token>'
    in the Authorization header.
    """
    def authenticate(self, request):
        auth = request.headers.get('Authorization', '').split()
        if not auth:
            return None

        keyword = auth[0].lower()
        if keyword not in ('bearer', 'token'):
            return None

        if len(auth) == 1:
            msg = _('Invalid token header. No credentials provided.')
            raise exceptions.AuthenticationFailed(msg)
        elif len(auth) > 2:
            msg = _('Invalid token header. Token string should not contain spaces.')
            raise exceptions.AuthenticationFailed(msg)

        token = auth[1]
        return self.authenticate_credentials(token)
