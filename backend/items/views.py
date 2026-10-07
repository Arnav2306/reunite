import uuid
from rest_framework import viewsets, status, filters
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q

from accounts.permissions import IsStaff, IsStudent
from .models import FoundItem, LostItem, ItemImage, ItemStatus, Match, MatchStatus
from .serializers import (
    FoundItemAdminSerializer,
    AvailableItemPublicSerializer,
    ItemImageSerializer,
    LostItemSerializer,
    MatchSerializer,
)
from .services.matching import (
    evaluate_found_item_matches,
    evaluate_lost_item_matches,
    get_match_label,
)

class FoundItemAdminViewSet(viewsets.ModelViewSet):
    """
    Administrative management of Found Items registered at HOD Cabin or Custodial stations.
    Restricted to IsStaff (custodian, admin, superadmin).
    Students attempting to access this endpoint will receive HTTP 403 Forbidden.
    """
    queryset = FoundItem.objects.all().order_by('-created_at')
    serializer_class = FoundItemAdminSerializer
    permission_classes = [IsStaff]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    lookup_field = 'public_id'

    def get_queryset(self):
        qs = FoundItem.objects.all().order_by('-created_at')
        
        # Filtering
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(serial_number__icontains=search) |
                Q(finder__icontains=search) |
                Q(found_location__icontains=search)
            )

        category = self.request.query_params.get('category')
        if category and category != 'all':
            qs = qs.filter(category__iexact=category)

        item_status = self.request.query_params.get('status')
        if item_status and item_status != 'all':
            qs = qs.filter(status__iexact=item_status)

        risk_tier = self.request.query_params.get('risk_tier')
        if risk_tier is not None and risk_tier != 'all':
            try:
                qs = qs.filter(risk_tier=int(risk_tier))
            except ValueError:
                pass

        is_published = self.request.query_params.get('is_published')
        if is_published in ['true', 'True', '1']:
            qs = qs.filter(is_published=True)
        elif is_published in ['false', 'False', '0']:
            qs = qs.filter(is_published=False)

        return qs

    def perform_create(self, serializer):
        public_id = str(uuid.uuid4())
        item = serializer.save(public_id=public_id, user=self.request.user)

        # Process uploaded images from multipart request
        images = self.request.FILES.getlist('images') or self.request.FILES.getlist('image')
        content_type = ContentType.objects.get_for_model(FoundItem)
        for img in images:
            ItemImage.objects.create(
                content_type=content_type,
                object_id=item.id,
                image=img
            )

    @action(detail=True, methods=['post'])
    def publish(self, request, public_id=None):
        item = self.get_object()
        item.is_published = True
        item.published_at = timezone.now()
        if item.status in [ItemStatus.REPORTED, ItemStatus.DEPOSIT_PENDING]:
            item.status = ItemStatus.SECURE_HOLD
        item.save()
        evaluate_found_item_matches(item, notify=True)
        return Response(self.get_serializer(item).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def unpublish(self, request, public_id=None):
        item = self.get_object()
        item.is_published = False
        item.save()
        return Response(self.get_serializer(item).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_image(self, request, public_id=None):
        item = self.get_object()
        images = request.FILES.getlist('images') or request.FILES.getlist('image')
        if not images:
            return Response({'detail': 'No image file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        content_type = ContentType.objects.get_for_model(FoundItem)
        created_imgs = []
        for img in images:
            created = ItemImage.objects.create(
                content_type=content_type,
                object_id=item.id,
                image=img
            )
            created_imgs.append(created)

        serializer = ItemImageSerializer(created_imgs, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='case-details')
    def case_details(self, request, public_id=None):
        """
        Comprehensive administrative inspection of a found item case:
        - Item data & AI analysis
        - Matches with lost reports
        - Claims & verification records
        - Handover & OTP status
        - Custody & Collection point
        - Relevant audit events
        """
        item = self.get_object()
        from pickup.models import Claim
        from audit.models import AuditLog
        from items.models import Match

        # 1. Serialized item with all private fields & AI metadata
        item_data = self.get_serializer(item).data

        # 2. Associated matches
        matches = Match.objects.filter(found_item=item).select_related('lost_item', 'lost_item__user').order_by('-score')
        matches_data = []
        for m in matches:
            matches_data.append({
                'public_id': m.public_id,
                'score': m.score,
                'score_breakdown': m.score_breakdown,
                'status': m.status,
                'lost_item': {
                    'public_id': m.lost_item.public_id,
                    'category': m.lost_item.category,
                    'description': m.lost_item.description,
                    'user_name': m.lost_item.user.name,
                    'user_email': m.lost_item.user.email,
                }
            })

        # 3. Associated claims and verifications
        claims = Claim.objects.filter(found_item=item).select_related('student').prefetch_related('verification', 'pickup_requests__handover').order_by('-created_at')
        claims_data = []
        for c in claims:
            verif = getattr(c, 'verification', None)
            pr = next(iter(c.pickup_requests.all()), None)
            h = getattr(pr, 'handover', None) if pr else None
            claims_data.append({
                'public_id': c.public_id,
                'student_name': c.student.name,
                'student_email': c.student.email,
                'status': c.status,
                'admin_notes': c.admin_notes,
                'created_at': c.created_at,
                'verification': {
                    'question': verif.question if verif else None,
                    'student_answer': verif.student_answer if verif else None,
                    'submission_timestamp': verif.submission_timestamp if verif else None,
                } if verif else None,
                'handover': {
                    'public_id': str(h.public_id) if h else None,
                    'status': h.status if h else None,
                    'is_valuable': h.is_valuable if h else False,
                    'failed_attempts': h.failed_otp_attempts if h else 0,
                    'confirmed_at': h.confirmed_at if h else None,
                } if h else None,
            })

        # 4. Relevant Audit Logs
        audit_logs = AuditLog.objects.filter(
            Q(target_id=str(item.public_id)) |
            Q(target_id__in=[c.public_id for c in claims]) |
            Q(details__item_title=item.title)
        ).select_related('actor').order_by('-timestamp')[:20]
        audit_data = [
            {
                'action': log.action,
                'actor_email': log.actor.email if log.actor else 'System',
                'timestamp': log.timestamp,
                'details': log.details,
            }
            for log in audit_logs
        ]

        return Response({
            'item': item_data,
            'matches': matches_data,
            'claims': claims_data,
            'audit_logs': audit_data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='update-disposition')
    def update_disposition(self, request, public_id=None):
        """
        Updates unclaimed item stage and disposition outcome.
        Stage progression: ACTIVE_RECOVERY -> REMINDER -> FINAL_REMINDER -> ADMIN_REVIEW -> DISPOSITION
        Outcomes: Returned, Transferred to College, Donated, Securely Retained, Destroyed where institutionally permitted, Other
        """
        from audit.models import AuditLog
        item = self.get_object()
        stage = request.data.get('unclaimed_stage')
        disp_type = request.data.get('disposition_type')
        notes = request.data.get('disposition_notes')

        if stage:
            item.unclaimed_stage = stage
        if disp_type:
            item.disposition_type = disp_type
            item.disposition_date = timezone.now()
        if notes is not None:
            item.disposition_notes = notes

        item.save()

        AuditLog.objects.create(
            actor=request.user,
            action='UNCLAIMED_DISPOSITION_UPDATE',
            target_type='FoundItem',
            target_id=str(item.public_id),
            details={'stage': item.unclaimed_stage, 'disposition_type': item.disposition_type}
        )

        return Response(self.get_serializer(item).data, status=status.HTTP_200_OK)


class AvailableItemsPublicViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public / Student catalog of published found items.
    Strictly returns safe fields only (no private serial numbers, IMEIs, internal notes).
    Only returns items where is_published=True.
    """
    serializer_class = AvailableItemPublicSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = FoundItem.objects.filter(is_published=True).select_related('collection_point').order_by('-published_at', '-created_at')

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(found_location__icontains=search)
            )

        category = self.request.query_params.get('category')
        if category and category != 'all':
            qs = qs.filter(category__iexact=category)

        building = self.request.query_params.get('building')
        if building and building != 'all':
            qs = qs.filter(collection_point__building__iexact=building)

        floor = self.request.query_params.get('floor')
        if floor and floor != 'all':
            qs = qs.filter(collection_point__floor__iexact=floor)

        risk_tier = self.request.query_params.get('risk_tier')
        if risk_tier is not None and risk_tier != 'all':
            try:
                qs = qs.filter(risk_tier=int(risk_tier))
            except ValueError:
                pass

        date = self.request.query_params.get('date')
        if date:
            qs = qs.filter(found_date=date)

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status__iexact=status_param)

        return qs


class AdminDashboardStatsView(APIView):
    """
    Returns REAL counts for the operational admin dashboard.
    Strictly uses database aggregation. No fake statistics.
    """
    permission_classes = [IsStaff]

    def get(self, request):
        from pickup.models import Claim, ClaimStatus, Dispute
        from handovers.models import Handover, HandoverStatus
        from items.models import Match, MatchStatus

        total_found = FoundItem.objects.count()
        awaiting_review = FoundItem.objects.filter(is_published=False).count()
        published_available = FoundItem.objects.filter(is_published=True).count()
        in_custody = FoundItem.objects.filter(
            status__in=[ItemStatus.DEPOSITED, ItemStatus.SECURE_HOLD, ItemStatus.READY_FOR_PICKUP]
        ).count()
        risk_valuable = FoundItem.objects.filter(risk_tier=1).count()

        pending_claims = Claim.objects.filter(status=ClaimStatus.PENDING).count()
        valuable_awaiting_verification = Claim.objects.filter(status=ClaimStatus.PENDING, found_item__risk_tier=1).count()
        pending_handovers = Handover.objects.filter(status__in=[HandoverStatus.PENDING_OTP, HandoverStatus.READY]).count()
        ready_for_pickup = FoundItem.objects.filter(status=ItemStatus.READY_FOR_PICKUP).count()
        candidate_matches = Match.objects.filter(status=MatchStatus.CANDIDATE).count()
        station_tasks = FoundItem.objects.filter(status=ItemStatus.DEPOSIT_PENDING).count()
        disputes = Dispute.objects.filter(status='OPEN').count()

        return Response({
            'total_found': total_found,
            'awaiting_review': awaiting_review,
            'published_available': published_available,
            'in_custody': in_custody,
            'risk_valuable': risk_valuable,
            'pending_claims': pending_claims,
            'valuable_awaiting_verification': valuable_awaiting_verification,
            'pending_handovers': pending_handovers,
            'ready_for_pickup': ready_for_pickup,
            'candidate_matches': candidate_matches,
            'station_tasks': station_tasks,
            'disputes': disputes,
        }, status=status.HTTP_200_OK)


class AnalyzeImageView(APIView):
    """
    AI-powered image analysis for Found Item reporting.
    Accepts a single image file (multipart), returns a structured suggestion.
    Open to all authenticated users (students and staff) — enables photo-first student found item workflow.
    Result is a suggestion only — reporter must review before saving.
    Never invents private facts (serial numbers, IMEIs, etc.).
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from .services.ai_description import analyze_item_image
        image_file = request.FILES.get('image')
        if not image_file:
            return Response(
                {'detail': 'No image file provided. Please upload an image.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        result = analyze_item_image(image_file)
        return Response(result, status=status.HTTP_200_OK)


class StudentFoundItemViewSet(viewsets.ModelViewSet):
    """
    Student-facing endpoint for reporting found items.
    Students submit found items with a photo; AI generates the description.
    The item is stored and immediately published so active recovery & matching can occur.
    Staff can view all; students can only view their own submissions.
    Private fields (serial_number, IMEI, etc.) are NOT accepted from students.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        from .serializers import StudentFoundItemSerializer
        return StudentFoundItemSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'role') and user.role in ['custodian', 'admin', 'superadmin']:
            return FoundItem.objects.filter(source='student_report').order_by('-created_at')
        return FoundItem.objects.filter(user=user, source='student_report').order_by('-created_at')

    def perform_create(self, serializer):
        from .services.matching import evaluate_found_item_matches
        public_id = str(uuid.uuid4())
        item = serializer.save(
            public_id=public_id,
            user=self.request.user,
            source='student_report',
            # Student-submitted items start as REPORTED/DEPOSIT_PENDING and are published for recovery
            status=ItemStatus.DEPOSIT_PENDING,
            is_published=True,
            published_at=timezone.now(),
        )

        # Handle image upload
        images = self.request.FILES.getlist('images') or self.request.FILES.getlist('image')
        content_type_obj = ContentType.objects.get_for_model(FoundItem)
        for img in images:
            ItemImage.objects.create(
                content_type=content_type_obj,
                object_id=item.id,
                image=img
            )

        # Evaluate matching immediately against active lost items
        evaluate_found_item_matches(item, notify=True)

    @action(detail=True, methods=['get'])
    def status_detail(self, request, pk=None):
        """Returns submission status for the student's found item report."""
        item = self.get_object()
        from .serializers import StudentFoundItemSerializer
        return Response(StudentFoundItemSerializer(item, context={'request': request}).data)


class LostItemViewSet(viewsets.ModelViewSet):
    """
    Student-facing endpoint for reporting lost items.
    Students can create and view their own lost item reports.
    Staff can view all lost items.
    """
    serializer_class = LostItemSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'role') and user.role in ['custodian', 'admin', 'superadmin']:
            return LostItem.objects.all().order_by('-created_at')
        return LostItem.objects.filter(user=user).order_by('-created_at')

    def get_permissions(self):
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        public_id = str(uuid.uuid4())
        item = serializer.save(public_id=public_id, user=self.request.user)

        # Handle optional image upload
        images = self.request.FILES.getlist('images') or self.request.FILES.getlist('image')
        content_type_obj = ContentType.objects.get_for_model(LostItem)
        for img in images:
            ItemImage.objects.create(
                content_type=content_type_obj,
                object_id=item.id,
                image=img
            )

        # Automatically evaluate matching against existing published found items
        evaluate_lost_item_matches(item, notify=True)

    @action(detail=True, methods=['get'])
    def matches(self, request, pk=None):
        try:
            lost_item = LostItem.objects.get(pk=pk)
        except LostItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        user = request.user
        is_staff_user = (
            user.is_staff or 
            (hasattr(user, 'role') and user.role in ['custodian', 'admin', 'superadmin'])
        )
        if not is_staff_user and lost_item.user != user:
            return Response(
                {'detail': 'You do not have permission to view matches for this item.'},
                status=status.HTTP_403_FORBIDDEN
            )
        matches = Match.objects.filter(lost_item=lost_item).select_related('found_item', 'lost_item').order_by('-score')
        serializer = MatchSerializer(matches, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='run-matching')
    def run_matching(self, request, pk=None):
        try:
            lost_item = LostItem.objects.get(pk=pk)
        except LostItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        user = request.user
        is_staff_user = (
            user.is_staff or 
            (hasattr(user, 'role') and user.role in ['custodian', 'admin', 'superadmin'])
        )
        if not is_staff_user and lost_item.user != user:
            return Response(
                {'detail': 'You do not have permission to run matching for this item.'},
                status=status.HTTP_403_FORBIDDEN
            )
        matches = evaluate_lost_item_matches(lost_item, notify=False)
        serializer = MatchSerializer(matches, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class MatchViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Retrieves match candidates for student reports or staff inspection.
    Students can only view matches for their own reports.
    Nesting strictly uses public representation of found items (no private fields).
    """
    serializer_class = MatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        is_staff_user = (
            user.is_staff or 
            (hasattr(user, 'role') and user.role in ['custodian', 'admin', 'superadmin'])
        )
        if is_staff_user:
            qs = Match.objects.all()
        else:
            qs = Match.objects.filter(lost_item__user=user)

        lost_item_id = self.request.query_params.get('lost_item')
        if lost_item_id:
            if str(lost_item_id).isdigit():
                qs = qs.filter(lost_item__id=int(lost_item_id))
            else:
                qs = qs.filter(lost_item__public_id=lost_item_id)

        match_status = self.request.query_params.get('status')
        if match_status and match_status != 'all':
            qs = qs.filter(status=match_status)

        return qs.select_related('lost_item', 'found_item').order_by('-score', '-created_at')

    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        try:
            match_obj = Match.objects.get(pk=pk)
        except Match.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        user = request.user
        is_staff_user = (
            user.is_staff or 
            (hasattr(user, 'role') and user.role in ['custodian', 'admin', 'superadmin'])
        )
        if not is_staff_user and match_obj.lost_item.user != user:
            return Response(
                {'detail': 'You do not have permission to modify this match.'},
                status=status.HTTP_403_FORBIDDEN
            )
        match_obj.status = MatchStatus.DISMISSED
        match_obj.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(match_obj).data, status=status.HTTP_200_OK)
