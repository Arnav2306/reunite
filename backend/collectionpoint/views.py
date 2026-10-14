from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsStaff
from .models import CollectionPoint
from .serializers import CollectionPointSerializer

class CollectionPointViewSet(viewsets.ModelViewSet):
    serializer_class = CollectionPointSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return CollectionPoint.objects.none()
        qs = CollectionPoint.objects.all().select_related('backup_station').order_by('building', 'station_code')
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status__iexact=status_param)
        return qs

    @action(detail=False, methods=['get'], url_path='by-code/(?P<station_code>[^/.]+)')
    def by_code(self, request, station_code=None):
        """Resolves stable QR station code (e.g. RNT-B2-F02-S01 or HOD-CABIN-101) to station details."""
        try:
            station = CollectionPoint.objects.select_related('backup_station').get(station_code__iexact=station_code)
            return Response(self.get_serializer(station).data, status=status.HTTP_200_OK)
        except CollectionPoint.DoesNotExist:
            return Response({'detail': f"Station code '{station_code}' not found."}, status=status.HTTP_404_NOT_FOUND)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsStaff()]
        return [IsAuthenticated()]


from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from .models import CampusConfig
from .serializers import CampusConfigSerializer

class CampusConfigView(APIView):
    """
    Singleton endpoint for college campus details.
    GET: Readable by any user (students, staff, public) to display official college details.
    PATCH/PUT: Restricted to staff/admin to configure college name, address, contact, maps link.
    """
    def get_permissions(self):
        if self.request.method in ['PATCH', 'PUT', 'POST']:
            return [IsStaff()]
        return [AllowAny()]

    def get(self, request):
        config = CampusConfig.get_solo()
        return Response(CampusConfigSerializer(config).data, status=status.HTTP_200_OK)

    def patch(self, request):
        config = CampusConfig.get_solo()
        data = request.data.copy()
        # If real name or address provided, mark as configured
        if data.get('name') and data.get('name') != 'Campus Configuration Pending':
            data['is_configured'] = True
        serializer = CampusConfigSerializer(config, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
