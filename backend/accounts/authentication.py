from rest_framework.authentication import TokenAuthentication
from rest_framework import exceptions
from django.utils.translation import gettext_lazy as _

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
