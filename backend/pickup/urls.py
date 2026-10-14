from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentClaimViewSet, StaffClaimViewSet, StudentDisputeViewSet, StaffDisputeViewSet, FeedbackViewSet

router = DefaultRouter()
router.register(r'claims/admin', StaffClaimViewSet, basename='claim-admin')
router.register(r'claims', StudentClaimViewSet, basename='claim-student')
router.register(r'disputes/admin', StaffDisputeViewSet, basename='dispute-admin')
router.register(r'disputes', StudentDisputeViewSet, basename='dispute-student')
router.register(r'feedback', FeedbackViewSet, basename='feedback')

urlpatterns = [
    path('', include(router.urls)),
]
