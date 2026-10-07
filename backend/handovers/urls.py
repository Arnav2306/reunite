from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HandoverStaffViewSet

router = DefaultRouter()
router.register(r'admin', HandoverStaffViewSet, basename='handover-admin')

urlpatterns = [
    path('', include(router.urls)),
]
