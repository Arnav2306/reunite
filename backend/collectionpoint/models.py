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
    map_link = models.CharField(max_length=500, blank=True, default='', help_text="Verified map link or coordinates")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"CollectionPoint {self.station_code} ({self.building})"


class CampusConfig(models.Model):
    """
    Singleton model holding official campus and institution information.
    Configurable by campus administrators without editing source code.
    """
    name = models.CharField(max_length=200, default='Campus Configuration Pending', help_text="College or University Name")
    address = models.TextField(blank=True, default='', help_text="Official campus street address")
    locality = models.CharField(max_length=150, blank=True, default='', help_text="Campus locality or campus sector")
    city = models.CharField(max_length=100, blank=True, default='', help_text="City")
    state = models.CharField(max_length=100, blank=True, default='', help_text="State / Province")
    pin_code = models.CharField(max_length=20, blank=True, default='', help_text="PIN / Postal Code")
    contact_email = models.EmailField(blank=True, default='', help_text="Official contact or lost-and-found email")
    contact_phone = models.CharField(max_length=50, blank=True, default='', help_text="Official lost-and-found contact phone")
    website = models.CharField(max_length=300, blank=True, default='', help_text="Official college website URL")
    maps_link = models.CharField(max_length=500, blank=True, default='', help_text="Official Google Maps or campus navigation URL")
    is_configured = models.BooleanField(default=False, help_text="True if real campus details have been configured")
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    def __str__(self):
        return f"CampusConfig: {self.name} (Configured: {self.is_configured})"

