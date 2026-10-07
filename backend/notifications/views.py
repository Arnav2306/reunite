from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound
from .models import Notification
from .serializers import NotificationSerializer

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    User Notifications API.
    Users can view and mark their own notifications as read.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'public_id'

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_val = str(self.kwargs.get(lookup_url_kwarg, ''))
        qs = self.filter_queryset(self.get_queryset())
        obj = None
        if lookup_val.isdigit():
            obj = qs.filter(id=int(lookup_val)).first()
        if not obj:
            obj = qs.filter(public_id=lookup_val).first()
        if not obj:
            raise NotFound('Notification not found.')
        self.check_object_permissions(self.request, obj)
        return obj

    @action(detail=True, methods=['post'])
    def read(self, request, public_id=None):
        notification = self.get_object()
        notification.read = True
        notification.save()
        return Response(self.get_serializer(notification).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response({'detail': 'All notifications marked as read.'}, status=status.HTTP_200_OK)
