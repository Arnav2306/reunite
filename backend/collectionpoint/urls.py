from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CollectionPointViewSet

router = DefaultRouter()
router.register(r'', CollectionPointViewSet, basename='collectionpoint')

urlpatterns = [
    path('', include(router.urls)),
]
