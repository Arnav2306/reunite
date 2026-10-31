from rest_framework import viewsets
from accounts.permissions import IsAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Admin-only audit log browser for institutional transparency and compliance.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = AuditLog.objects.all().select_related('actor').order_by('-timestamp')
        action = self.request.query_params.get('action')
        if action and action != 'all':
            qs = qs.filter(action__icontains=action)
        target_type = self.request.query_params.get('target_type')
        if target_type and target_type != 'all':
            qs = qs.filter(target_type__iexact=target_type)
        target_id = self.request.query_params.get('target_id')
        if target_id:
            qs = qs.filter(target_id=target_id)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(action__icontains=search)
        return qs[:100]
