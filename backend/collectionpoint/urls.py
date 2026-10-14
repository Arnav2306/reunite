from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CollectionPointViewSet, CampusConfigView, CampusBlockViewSet

router = DefaultRouter()
router.register(r'blocks', CampusBlockViewSet, basename='campus-blocks')
router.register(r'', CollectionPointViewSet, basename='collectionpoint')

urlpatterns = [
    path('campus-settings/', CampusConfigView.as_view(), name='campus-settings'),
    path('campus/', CampusConfigView.as_view(), name='campus'),
    path('', include(router.urls)),
]

