from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FoundItemAdminViewSet,
    AvailableItemsPublicViewSet,
    AdminDashboardStatsView,
    AnalyzeImageView,
    LostItemViewSet,
    MatchViewSet,
    StudentFoundItemViewSet,
)

router = DefaultRouter()
router.register(r'found-items', FoundItemAdminViewSet, basename='founditem-admin')
router.register(r'available-items', AvailableItemsPublicViewSet, basename='availableitem-public')
router.register(r'lost-items', LostItemViewSet, basename='lostitem')
router.register(r'matches', MatchViewSet, basename='match')
router.register(r'student-found', StudentFoundItemViewSet, basename='student-found')

urlpatterns = [
    path('admin-stats/', AdminDashboardStatsView.as_view(), name='admin-stats'),
    path('analyze-image/', AnalyzeImageView.as_view(), name='analyze-image'),
    path('', include(router.urls)),
]
