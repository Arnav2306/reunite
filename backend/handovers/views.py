from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.db.models import Q
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

        found_id = self.request.query_params.get('found_id') or self.request.query_params.get('exact_id')
        if found_id:
            qs = qs.filter(found_item__public_id__iexact=found_id.strip())

        search = self.request.query_params.get('search')
        if search:
            search_str = search.strip()
            qs = qs.filter(
                Q(found_item__public_id__iexact=search_str) |
                Q(public_id__iexact=search_str) |
                Q(found_item__title__icontains=search_str) |
                Q(student__email__icontains=search_str) |
                Q(student__name__icontains=search_str)
            )

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status__iexact=status_param)
        return qs

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_val = self.kwargs.get(lookup_url_kwarg, self.kwargs.get('pk'))
        obj = self.get_queryset().filter(public_id=lookup_val).first()
        if not obj:
            obj = self.get_queryset().filter(found_item__public_id__iexact=lookup_val).first()
        if not obj:
            from django.http import Http404
            raise Http404('No Handover matches the given query.')
        self.check_object_permissions(self.request, obj)
        return obj

    @action(detail=True, methods=['post'], url_path='verify-otp')
    def verify_otp_action(self, request, pk=None):
        """
        Verifies student OTP for valuable item handover and completes recovery.
        """
        handover = self.get_object()

        if handover.status == HandoverStatus.COMPLETED or handover.otp_used:
            return Response({'detail': 'Handover is already completed.'}, status=status.HTTP_400_BAD_REQUEST)

        otp = request.data.get('otp', '').strip()
        if not otp:
            return Response({'detail': 'OTP code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check for open disputes
        from pickup.models import Dispute, DisputeStatus
        open_dispute = Dispute.objects.filter(
            found_item=handover.found_item,
            status__in=[DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW, DisputeStatus.INFO_REQUESTED]
        ).first()
        if open_dispute:
            return Response(
                {'detail': f'Cannot complete handover: an active dispute ({open_dispute.public_id}) is currently pending on this item. Resolve disputes before handover.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate OTP using service (raises ValidationError if invalid/expired/locked)
        verify_otp(handover, otp)

        # Enforce that ownership verification workflow exists and claim is approved
        claim = getattr(handover.pickup_request, 'claim', None) if handover.pickup_request else None
        if not claim or claim.status != 'APPROVED':
            return Response(
                {'detail': 'Cannot complete handover: associated claim is not approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        verif = getattr(claim, 'verification', None)
        if verif and not (verif.student_answer and verif.student_answer.strip()):
            return Response(
                {'detail': 'Cannot complete handover: ownership verification response is missing.'},
                status=status.HTTP_400_BAD_REQUEST
            )

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

            # Resolve linked student lost reports and mark match claimed
            from items.models import Match, MatchStatus
            linked_matches = Match.objects.filter(found_item=item, lost_item__user=handover.student)
            for m in linked_matches:
                if m.lost_item.status != ItemStatus.RESOLVED:
                    m.lost_item.status = ItemStatus.RESOLVED
                    m.lost_item.save(update_fields=['status', 'updated_at'])
                m.status = MatchStatus.CLAIMED
                m.save(update_fields=['status', 'updated_at'])

            AuditLog.objects.create(
                actor=request.user,
                action='OTP_VERIFICATION_SUCCESS',
                target_type='Handover',
                target_id=str(handover.public_id),
                details={
                    'item_title': item.title,
                    'item_id': str(item.public_id),
                    'student_id': handover.student.id,
                    'student_email': handover.student.email,
                    'student_name': handover.student.name,
                    'custodian_id': request.user.id,
                    'custodian_email': request.user.email,
                    'timestamp': handover.confirmed_at.isoformat(),
                }
            )

            AuditLog.objects.create(
                actor=request.user,
                action='HANDOVER_COMPLETED',
                target_type='Handover',
                target_id=str(handover.public_id),
                details={
                    'item_title': item.title,
                    'item_id': str(item.public_id),
                    'is_valuable': True,
                    'recipient_id': handover.student.id,
                    'recipient_email': handover.student.email,
                    'staff_member': request.user.email,
                    'confirmed_at': handover.confirmed_at.isoformat(),
                }
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

        # Enforce that valuable items cannot bypass OTP verification
        if handover.is_valuable:
            return Response(
                {'detail': 'Valuable items require secure OTP verification before handover and cannot be completed via general collection.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for open disputes
        from pickup.models import Dispute, DisputeStatus
        open_dispute = Dispute.objects.filter(
            found_item=handover.found_item,
            status__in=[DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW, DisputeStatus.INFO_REQUESTED]
        ).first()
        if open_dispute:
            return Response(
                {'detail': f'Cannot complete handover: an active dispute ({open_dispute.public_id}) is currently pending on this item. Resolve disputes before handover.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce that ownership verification workflow exists and claim is approved
        claim = getattr(handover.pickup_request, 'claim', None) if handover.pickup_request else None
        if not claim or claim.status != 'APPROVED':
            return Response(
                {'detail': 'Cannot complete handover: associated claim is not approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        verif = getattr(claim, 'verification', None)
        if verif and not (verif.student_answer and verif.student_answer.strip()):
            return Response(
                {'detail': 'Cannot complete handover: ownership verification response is missing.'},
                status=status.HTTP_400_BAD_REQUEST
            )

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

            # Resolve linked student lost reports and mark match claimed
            from items.models import Match, MatchStatus
            linked_matches = Match.objects.filter(found_item=item, lost_item__user=handover.student)
            for m in linked_matches:
                if m.lost_item.status != ItemStatus.RESOLVED:
                    m.lost_item.status = ItemStatus.RESOLVED
                    m.lost_item.save(update_fields=['status', 'updated_at'])
                m.status = MatchStatus.CLAIMED
                m.save(update_fields=['status', 'updated_at'])

            AuditLog.objects.create(
                actor=request.user,
                action='HANDOVER_COMPLETED',
                target_type='Handover',
                target_id=str(handover.public_id),
                details={
                    'item_title': item.title,
                    'item_id': str(item.public_id),
                    'is_valuable': False,
                    'recipient_id': handover.student.id,
                    'recipient_email': handover.student.email,
                    'staff_member': request.user.email,
                    'confirmed_at': handover.confirmed_at.isoformat(),
                }
            )

            Notification.objects.create(
                user=handover.student,
                title='Item Collection Confirmed',
                message=f"Collection confirmed for '{item.title}'. Physical handover is complete!",
                notification_type='HANDOVER_COMPLETED'
            )

        return Response(self.get_serializer(handover).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='regenerate-otp')
    def regenerate_otp_action(self, request, pk=None):
        """
        Regenerates a secure OTP for valuable items upon staff request.
        Invalidates previous codes and delivers new code to the recipient.
        """
        handover = self.get_object()
        from .services import regenerate_otp
        regenerate_otp(handover, requested_by=request.user)
        return Response(self.get_serializer(handover).data, status=status.HTTP_200_OK)
