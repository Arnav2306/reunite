from django.urls import include, path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health'),
    path('auth/', include('accounts.urls')),
    path('items/', include('items.urls')),
    path('collection-points/', include('collectionpoint.urls')),
    path('pickup/', include('pickup.urls')),
    path('handovers/', include('handovers.urls')),
    path('notifications/', include('notifications.urls')),
]
