from django.db import models
from django.utils.translation import gettext_lazy as _

class CollectionPoint(models.Model):
    """Model representing a collection point (station) where found items can be deposited."""
    public_id = models.CharField(max_length=36, unique=True)
    station_code = models.CharField(max_length=20, unique=True)
    building = models.CharField(max_length=100)
    floor = models.CharField(max_length=10, blank=True)
    station_type = models.CharField(max_length=50)
    status = models.CharField(max_length=20, default='ACTIVE')
    capacity = models.PositiveIntegerField(default=0)
    current_count = models.PositiveIntegerField(default=0)
    opening_hours = models.JSONField(default=dict, blank=True)
    backup_station = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='backup_for')
    zone = models.CharField(max_length=50, blank=True)
    directions = models.TextField(blank=True, default='', help_text="Walking directions within campus")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"CollectionPoint {self.station_code} ({self.building})"

