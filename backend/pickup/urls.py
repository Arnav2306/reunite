from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentClaimViewSet, StaffClaimViewSet, StudentDisputeViewSet, StaffDisputeViewSet

router = DefaultRouter()
router.register(r'claims/admin', StaffClaimViewSet, basename='claim-admin')
router.register(r'claims', StudentClaimViewSet, basename='claim-student')
router.register(r'disputes/admin', StaffDisputeViewSet, basename='dispute-admin')
router.register(r'disputes', StudentDisputeViewSet, basename='dispute-student')

urlpatterns = [
    path('', include(router.urls)),
]
