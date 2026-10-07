from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from accounts.permissions import IsStaff
from .models import Handover, HandoverStatus
from .serializers import HandoverStaffDetailSerializer
from .services import verify_otp
from items.models import ItemStatus
from audit.models import AuditLog
from notifications.models import Notification

class HandoverStaffViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Staff Handover Management Center.
    Custodians and Admins can view pending handovers, verify OTPs for valuable items,
    and confirm physical collections for general items.
    """
    queryset = Handover.objects.all().order_by('-created_at')
    serializer_class = HandoverStaffDetailSerializer
    permission_classes = [IsStaff]
    lookup_field = 'public_id'
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        qs = Handover.objects.all().order_by('-created_at')
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status__iexact=status_param)
        return qs

    @action(detail=True, methods=['post'], url_path='verify-otp')
    def verify_otp_action(self, request, pk=None):
        """
        Verifies student OTP for valuable item handover and completes recovery.
        """
        handover = self.get_object()
        otp = request.data.get('otp', '').strip()
        if not otp:
            return Response({'detail': 'OTP code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate OTP using service (raises ValidationError if invalid/expired/locked)
        verify_otp(handover, otp)

        # Transactionally complete handover and resolve item & pickup request
        with transaction.atomic():
            handover.otp_used = True
            handover.status = HandoverStatus.COMPLETED
            handover.custodian = request.user
            handover.confirmed_at = timezone.now()
            handover.save()

            pickup_req = handover.pickup_request
            pickup_req.status = ItemStatus.RESOLVED
            pickup_req.save()

            item = handover.found_item
            item.status = ItemStatus.RESOLVED
            item.save()

            AuditLog.objects.create(
                actor=request.user,
                action='OTP_VERIFICATION_SUCCESS',
                target_type='Handover',
                target_id=str(handover.public_id),
                details={'item_title': item.title, 'student_email': handover.student.email}
            )

            AuditLog.objects.create(
                actor=request.user,
                action='HANDOVER_COMPLETED',
                target_type='Handover',
                target_id=str(handover.public_id),
                details={'item_title': item.title, 'is_valuable': True}
            )

            Notification.objects.create(
                user=handover.student,
                title='Handover Completed & Resolved',
                message=f"Your OTP was verified for '{item.title}'. Physical handover is complete and your recovery is resolved!",
                notification_type='HANDOVER_COMPLETED'
            )

        return Response(self.get_serializer(handover).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='confirm-collection')
    def confirm_collection(self, request, pk=None):
        """
        Confirms physical collection for general (non-valuable) items.
        """
        handover = self.get_object()

        if handover.status == HandoverStatus.COMPLETED:
            return Response({'detail': 'Handover is already completed.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            handover.status = HandoverStatus.COMPLETED
            handover.custodian = request.user
            handover.confirmed_at = timezone.now()
            handover.save()

            pickup_req = handover.pickup_request
            pickup_req.status = ItemStatus.RESOLVED
            pickup_req.save()

            item = handover.found_item
            item.status = ItemStatus.RESOLVED
            item.save()

            AuditLog.objects.create(
                actor=request.user,
                action='HANDOVER_COMPLETED',
                target_type='Handover',
                target_id=str(handover.public_id),
                details={'item_title': item.title, 'is_valuable': False}
            )

            Notification.objects.create(
                user=handover.student,
                title='Item Collection Confirmed',
                message=f"Collection confirmed for '{item.title}'. Physical handover is complete!",
                notification_type='HANDOVER_COMPLETED'
            )

        return Response(self.get_serializer(handover).data, status=status.HTTP_200_OK)
