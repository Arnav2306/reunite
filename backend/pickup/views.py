from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction, IntegrityError
from django.contrib.contenttypes.models import ContentType
from accounts.permissions import IsStudent, IsStaff
from .models import Claim, ClaimStatus, OwnershipVerification, PickupRequest
from .serializers import ClaimStudentSerializer, ClaimAdminSerializer, CreateClaimSerializer
from items.models import FoundItem, ItemStatus
from handovers.models import Handover, HandoverStatus
from handovers.services import generate_otp
from audit.models import AuditLog
from notifications.models import Notification


def _attach_handover_records(claim_iterable):
    """
    Attach ``handover_record`` attribute to each Claim in the iterable.

    Assumes ``pickup_requests`` and ``pickup_requests__handover`` have already
    been prefetched so that no additional DB queries are issued here.
    """
    for claim in claim_iterable:
        pr = next(iter(claim.pickup_requests.all()), None)
        claim.handover_record = getattr(pr, 'handover', None) if pr else None
    return claim_iterable


class StudentClaimViewSet(viewsets.ModelViewSet):
    """
    Student Claims API.
    Students can lodge claims for published found items and track their recovery progress.
    """
    serializer_class = ClaimStudentSerializer
    permission_classes = [IsStudent]

    def get_queryset(self):
        """
        Return claims for the authenticated student only.

        Uses select_related to eagerly load all FK relations needed by the serializer,
        and prefetch_related for the one-to-many / one-to-one relations
        (OwnershipVerification, PickupRequest, Handover).
        This collapses the previously O(n) Python-loop approach into a fixed,
        small number of DB queries regardless of result-set size.
        """
        return (
            Claim.objects
            .filter(student=self.request.user)
            .select_related(
                'found_item',
                'found_item__collection_point',
                'found_item__user',
            )
            .prefetch_related(
                'verification',
                'pickup_requests',
                'pickup_requests__handover',
                'pickup_requests__handover__student',
                'pickup_requests__handover__custodian',
            )
            .order_by('-created_at')
        )

    def create(self, request, *args, **kwargs):
        serializer = CreateClaimSerializer(data=request.data)
        serializer.is_validate_or_400 = serializer.is_valid(raise_exception=True)
        item = serializer.validated_data['found_item_id']
        student_answer = serializer.validated_data['student_answer']

        # Fraud / Abuse Protection: rate limit check on claims per student
        from django.utils import timezone
        import datetime
        recent_cutoff = timezone.now() - datetime.timedelta(minutes=15)
        recent_claims_count = Claim.objects.filter(student=request.user, created_at__gte=recent_cutoff).count()
        if recent_claims_count >= 5:
            AuditLog.objects.create(
                actor=request.user,
                action='EXCESSIVE_CLAIMS_FLAGGED',
                target_type='User',
                target_id=str(request.user.pk),
                details={'claims_count_15min': recent_claims_count}
            )
            return Response(
                {'detail': 'Too many claim submissions in a short period. Please wait before submitting another claim.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        # Friendly pre-check: prevents a confusing IntegrityError message
        existing_claim = Claim.objects.filter(
            student=request.user,
            found_item=item,
            status__in=[ClaimStatus.PENDING, ClaimStatus.APPROVED]
        ).first()

        if existing_claim:
            return Response(
                {'detail': 'You already have an active claim submitted for this item.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if item.status in [ItemStatus.RESOLVED, ItemStatus.HANDOVER]:
            return Response(
                {'detail': 'This item is no longer available for claim.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        question_text = (
            f"Describe identifying features, serial numbers, marks, or specific contents "
            f"of this {item.title or item.category}."
        )

        try:
            with transaction.atomic():
                claim = Claim.objects.create(
                    student=request.user,
                    found_item=item,
                    status=ClaimStatus.PENDING
                )

                OwnershipVerification.objects.create(
                    claim=claim,
                    question=question_text,
                    student_answer=student_answer
                )

                AuditLog.objects.create(
                    actor=request.user,
                    action='CLAIM_CREATED',
                    target_type='Claim',
                    target_id=str(claim.public_id),
                    details={'item_id': str(item.public_id), 'item_title': item.title}
                )

                Notification.objects.create(
                    user=request.user,
                    title='Claim Submitted',
                    message=f"Your claim for '{item.title}' has been submitted and is currently under staff review.",
                    notification_type='CLAIM_SUBMITTED'
                )

        except IntegrityError:
            # DB-level unique constraint caught a race-condition duplicate
            return Response(
                {'detail': 'An active claim already exists for this item.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # For the immediate create response the handover does not exist yet
        claim.handover_record = None
        output_serializer = ClaimStudentSerializer(claim, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-claims')
    def my_claims(self, request):
        qs = list(self.get_queryset())
        _attach_handover_records(qs)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class StaffClaimViewSet(viewsets.ModelViewSet):
    """
    Staff / Custodian Claim Verification Center.
    Custodians and Admins can review pending student claims, inspect student verification
    answers against private item attributes, and approve or reject claims.
    """
    serializer_class = ClaimAdminSerializer
    permission_classes = [IsStaff]
    lookup_field = 'public_id'
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        """
        Return claims for staff with:
        - DB-level status filtering (previously used Python list comprehension — O(n) memory scan)
        - select_related to avoid N+1 queries on student, found_item, and collection_point
        - prefetch_related for OwnershipVerification and Handover chains
        """
        qs = (
            Claim.objects
            .select_related(
                'student',
                'found_item',
                'found_item__collection_point',
                'found_item__user',
            )
            .prefetch_related(
                'verification',
                'pickup_requests',
                'pickup_requests__handover',
                'pickup_requests__handover__student',
                'pickup_requests__handover__custodian',
            )
            .order_by('-created_at')
        )

        # DB-level status filter — replaced previous Python list comprehension
        status_param = self.request.query_params.get('status')
        if status_param and status_param.lower() != 'all':
            qs = qs.filter(status__iexact=status_param)

        return qs

    def list(self, request, *args, **kwargs):
        qs = list(self.get_queryset())
        _attach_handover_records(qs)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='admin-list')
    def admin_list(self, request):
        qs = list(self.get_queryset())
        _attach_handover_records(qs)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        claim = self.get_object()

        if claim.status != ClaimStatus.PENDING:
            return Response(
                {'detail': f'Claim cannot be approved because it is in status {claim.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        item = claim.found_item
        is_valuable = (item.risk_tier == 1)

        with transaction.atomic():
            claim.status = ClaimStatus.APPROVED
            if request.data.get('admin_notes'):
                claim.admin_notes = request.data.get('admin_notes')
            claim.save()

            # Update item lifecycle status
            item.status = ItemStatus.READY_FOR_PICKUP
            item.save()

            # Create or update PickupRequest
            content_type = ContentType.objects.get_for_model(FoundItem)
            pickup_req, _created = PickupRequest.objects.get_or_create(
                requester=claim.student,
                content_type=content_type,
                object_id=item.id,
                defaults={
                    'claim': claim,
                    'collection_point': item.collection_point,
                    'status': ItemStatus.READY_FOR_PICKUP,
                    'pickup_instructions': (
                        f"Please collect your item at "
                        f"{item.collection_point.station_code if item.collection_point else 'Custodial Desk'}"
                        f" during operational hours."
                    )
                }
            )
            if not _created:
                pickup_req.claim = claim
                pickup_req.status = ItemStatus.READY_FOR_PICKUP
                pickup_req.save()

            # Create Handover record
            handover, _h_created = Handover.objects.get_or_create(
                pickup_request=pickup_req,
                defaults={
                    'found_item': item,
                    'student': claim.student,
                    'is_valuable': is_valuable,
                    'status': HandoverStatus.PENDING_OTP if is_valuable else HandoverStatus.READY
                }
            )

            otp_code = None
            if is_valuable:
                otp_code = generate_otp(handover)

            AuditLog.objects.create(
                actor=request.user,
                action='CLAIM_APPROVED',
                target_type='Claim',
                target_id=str(claim.public_id),
                details={
                    'item_title': item.title,
                    'student_email': claim.student.email,
                    'is_valuable': is_valuable
                }
            )

            # Student notification — OTP delivered here as the delivery channel
            cp_label = (
                f"{item.collection_point.station_code} ({item.collection_point.building})"
                if item.collection_point else "the Custodial Office"
            )
            notif_msg = (
                f"Your claim for '{item.title}' has been APPROVED! "
                f"Your item is ready for collection at {cp_label}."
            )
            if is_valuable and otp_code:
                notif_msg += (
                    f" This is a valuable item. Your secure pickup OTP is: {otp_code}"
                    f" (Valid for 24 hours)."
                )

            Notification.objects.create(
                user=claim.student,
                title='Claim Approved — Ready for Collection',
                message=notif_msg,
                notification_type='CLAIM_APPROVED'
            )

        claim.handover_record = handover
        return Response(self.get_serializer(claim).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        claim = self.get_object()

        if claim.status != ClaimStatus.PENDING:
            return Response(
                {'detail': f'Claim cannot be rejected because it is in status {claim.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        admin_notes = request.data.get(
            'admin_notes', 'Verification details did not match custodial records.'
        )

        with transaction.atomic():
            claim.status = ClaimStatus.REJECTED
            claim.admin_notes = admin_notes
            claim.save()

            AuditLog.objects.create(
                actor=request.user,
                action='CLAIM_REJECTED',
                target_type='Claim',
                target_id=str(claim.public_id),
                details={
                    'item_title': claim.found_item.title,
                    'student_email': claim.student.email,
                    'reason': admin_notes
                }
            )

            Notification.objects.create(
                user=claim.student,
                title='Claim Status Update',
                message=(
                    f"Your claim for '{claim.found_item.title}' was reviewed and rejected. "
                    f"Reason: {admin_notes}"
                ),
                notification_type='CLAIM_REJECTED'
            )

        claim.handover_record = None
        return Response(self.get_serializer(claim).data, status=status.HTTP_200_OK)


class StudentDisputeViewSet(viewsets.ModelViewSet):
    """
    Student Dispute Filing & Tracking API.
    Students can file disputes on claims or items and track administrative status.
    """
    from .models import Dispute
    from .serializers import DisputeSerializer
    serializer_class = DisputeSerializer
    permission_classes = [IsStudent]
    lookup_field = 'public_id'

    def get_queryset(self):
        from .models import Dispute
        return Dispute.objects.filter(reporter=self.request.user).select_related(
            'claim', 'found_item', 'reporter'
        ).order_by('-created_at')

    def perform_create(self, serializer):
        from .models import Dispute
        import uuid
        dispute = serializer.save(reporter=self.request.user, public_id=str(uuid.uuid4()))
        AuditLog.objects.create(
            actor=self.request.user,
            action='DISPUTE_FILED',
            target_type='Dispute',
            target_id=str(dispute.public_id),
            details={
                'reason': dispute.reason,
                'description': dispute.description[:100],
                'claim_id': str(dispute.claim.public_id) if dispute.claim else None,
                'item_id': str(dispute.found_item.public_id) if dispute.found_item else None,
            }
        )


class StaffDisputeViewSet(viewsets.ModelViewSet):
    """
    Staff Dispute Queue Management API.
    Custodial staff and admins review, request info, escalate, or resolve disputes.
    """
    from .models import Dispute
    from .serializers import DisputeSerializer
    serializer_class = DisputeSerializer
    permission_classes = [IsStaff]
    lookup_field = 'public_id'

    def get_queryset(self):
        from .models import Dispute
        qs = Dispute.objects.all().select_related('claim', 'found_item', 'reporter').order_by('-created_at')
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status__iexact=status_param)
        return qs

    @action(detail=True, methods=['post'])
    def resolve(self, request, public_id=None):
        dispute = self.get_object()
        notes = request.data.get('admin_response', 'Dispute reviewed and resolved.')
        dispute.status = 'RESOLVED'
        dispute.admin_response = notes
        dispute.save()

        AuditLog.objects.create(
            actor=request.user,
            action='DISPUTE_RESOLVED',
            target_type='Dispute',
            target_id=str(dispute.public_id),
            details={'response': notes}
        )
        Notification.objects.create(
            user=dispute.reporter,
            title='Dispute Resolved',
            message=f"Your dispute concerning '{dispute.found_item.title if dispute.found_item else 'item'}' has been resolved: {notes}",
            notification_type='DISPUTE_UPDATE'
        )
        return Response(self.get_serializer(dispute).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, public_id=None):
        dispute = self.get_object()
        notes = request.data.get('admin_response', 'Dispute rejected upon verification.')
        dispute.status = 'REJECTED'
        dispute.admin_response = notes
        dispute.save()

        AuditLog.objects.create(
            actor=request.user,
            action='DISPUTE_REJECTED',
            target_type='Dispute',
            target_id=str(dispute.public_id),
            details={'response': notes}
        )
        Notification.objects.create(
            user=dispute.reporter,
            title='Dispute Closed',
            message=f"Your dispute was reviewed and closed: {notes}",
            notification_type='DISPUTE_UPDATE'
        )
        return Response(self.get_serializer(dispute).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def escalate(self, request, public_id=None):
        dispute = self.get_object()
        notes = request.data.get('admin_response', 'Escalated to Head of Custodial Operations.')
        dispute.status = 'ESCALATED'
        dispute.admin_response = notes
        dispute.save()

        AuditLog.objects.create(
            actor=request.user,
            action='DISPUTE_ESCALATED',
            target_type='Dispute',
            target_id=str(dispute.public_id),
            details={'response': notes}
        )
        return Response(self.get_serializer(dispute).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def request_info(self, request, public_id=None):
        dispute = self.get_object()
        notes = request.data.get('admin_response', 'Additional information required.')
        dispute.status = 'INFO_REQUESTED'
        dispute.admin_response = notes
        dispute.save()

        AuditLog.objects.create(
            actor=request.user,
            action='DISPUTE_INFO_REQUESTED',
            target_type='Dispute',
            target_id=str(dispute.public_id),
            details={'response': notes}
        )
        Notification.objects.create(
            user=dispute.reporter,
            title='Additional Info Requested for Dispute',
            message=f"Staff requested more details for your dispute: {notes}",
            notification_type='DISPUTE_UPDATE'
        )
        return Response(self.get_serializer(dispute).data, status=status.HTTP_200_OK)


class FeedbackViewSet(viewsets.ModelViewSet):
    """
    Feedback submission and inspection.
    Students/users can submit ratings (1-5) and comments.
    Staff can view all feedback and aggregate ratings.
    """
    from .models import Feedback
    from .serializers import FeedbackSerializer
    from rest_framework.permissions import IsAuthenticated
    serializer_class = FeedbackSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from .models import Feedback
        user = self.request.user
        is_staff_user = (user.is_staff or (hasattr(user, 'role') and user.role in ['custodian', 'admin', 'superadmin']))
        if is_staff_user:
            return Feedback.objects.all().select_related('user', 'claim', 'found_item').order_by('-created_at')
        return Feedback.objects.filter(user=user).select_related('claim', 'found_item').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        from .models import Feedback
        from django.db.models import Avg
        total = Feedback.objects.count()
        avg = Feedback.objects.aggregate(Avg('rating'))['rating__avg'] or 0.0
        return Response({
            'total_feedback': total,
            'average_rating': round(avg, 2),
        }, status=status.HTTP_200_OK)

