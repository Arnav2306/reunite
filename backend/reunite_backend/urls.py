from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from reunite_backend.api.views import health_check

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('healthz/', health_check, name='healthz-check'),
    path('api/', include('reunite_backend.api.urls')),
    path('admin/', admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
