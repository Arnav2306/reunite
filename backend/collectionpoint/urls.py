from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CollectionPointViewSet, CampusConfigView

router = DefaultRouter()
router.register(r'', CollectionPointViewSet, basename='collectionpoint')

urlpatterns = [
    path('campus-settings/', CampusConfigView.as_view(), name='campus-settings'),
    path('', include(router.urls)),
]
