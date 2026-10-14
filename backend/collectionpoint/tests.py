import json
import tempfile
import os
from django.test import TestCase
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User
from .models import CollectionPoint, CampusConfig

class CampusConfigAndStationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            email='student.test@gmail.com',
            password='password123',
            name='Test Student',
            role='student'
        )
        self.staff = User.objects.create_user(
            email='custodian.test@college.edu',
            password='password123',
            name='Campus Custodian',
            role='custodian',
            is_staff=True
        )

    def test_campus_config_defaults(self):
        config = CampusConfig.get_solo()
        self.assertEqual(config.name, 'Campus Configuration Pending')
        self.assertFalse(config.is_configured)

    def test_campus_settings_get_public(self):
        resp = self.client.get('/api/collection-points/campus-settings/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('name', resp.data)
        self.assertIn('is_configured', resp.data)
        self.assertFalse(resp.data['is_configured'])

    def test_campus_settings_patch_forbidden_for_student(self):
        self.client.force_authenticate(user=self.student)
        resp = self.client.patch('/api/collection-points/campus-settings/', {
            'name': 'Hacked University',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_campus_settings_patch_allowed_for_staff(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.patch('/api/collection-points/campus-settings/', {
            'name': 'National Institute of Technology',
            'address': 'Campus Sector 5, Main Avenue',
            'locality': 'Tech Campus Zone',
            'city': 'Bengaluru',
            'state': 'Karnataka',
            'pin_code': '560001',
            'contact_email': 'lostandfound@nit.edu',
            'contact_phone': '+91-9876543210',
            'website': 'https://www.nit.edu',
            'maps_link': 'https://maps.google.com/?q=NIT+Main+Campus',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['name'], 'National Institute of Technology')
        self.assertTrue(resp.data['is_configured'])
        self.assertEqual(resp.data['city'], 'Bengaluru')

        # Verify persists in db
        config = CampusConfig.get_solo()
        self.assertEqual(config.name, 'National Institute of Technology')
        self.assertTrue(config.is_configured)
        self.assertEqual(config.pin_code, '560001')

    def test_station_creation_with_map_link_and_capacity(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post('/api/collection-points/', {
            'station_code': 'STN-LIB-F01',
            'building': 'Central Library',
            'floor': '1st Floor',
            'station_type': 'Circulation Desk',
            'status': 'ACTIVE',
            'zone': 'Academic Quad',
            'capacity': 75,
            'directions': 'Next to front entry turnstiles',
            'map_link': 'https://maps.google.com/?q=12.9716,77.5946',
            'opening_hours': {'Monday - Saturday': '08:00 - 20:00'},
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['station_code'], 'STN-LIB-F01')
        self.assertEqual(resp.data['map_link'], 'https://maps.google.com/?q=12.9716,77.5946')
        self.assertEqual(resp.data['capacity'], 75)

    def test_station_by_code_lookup(self):
        CollectionPoint.objects.create(
            public_id='test-pub-id-123',
            station_code='RNT-SCI-F02',
            building='Science Block',
            floor='2nd Floor',
            station_type='HOD Office',
            status='ACTIVE'
        )
        self.client.force_authenticate(user=self.student)
        resp = self.client.get('/api/collection-points/by-code/rnt-sci-f02/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['building'], 'Science Block')

    def test_setup_campus_stations_command_imports_campus_and_stations(self):
        sample_data = {
            "campus": {
                "name": "State Engineering College",
                "address": "42 Innovation Way",
                "locality": "North Sector",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pin_code": "400001",
                "contact_email": "reunite@sec.edu",
                "contact_phone": "+91-9876500000",
                "website": "https://www.sec.edu",
                "maps_link": "https://maps.google.com/?q=SEC+Campus"
            },
            "stations": [
                {
                    "code": "SEC-ENG-F01",
                    "building": "Engineering Building",
                    "floor": "Ground Floor",
                    "name": "Security Cabin A",
                    "status": "ACTIVE",
                    "capacity": 40,
                    "directions": "Near main gate security office",
                    "map_link": "https://maps.google.com/?q=Gate1",
                    "opening_hours": {"Everyday": "24/7"}
                }
            ]
        }
        with tempfile.NamedTemporaryFile('w', delete=False, suffix='.json') as f:
            json.dump(sample_data, f)
            temp_path = f.name

        try:
            call_command('setup_campus_stations', file=temp_path)
            # Verify campus config was loaded
            cfg = CampusConfig.get_solo()
            self.assertEqual(cfg.name, "State Engineering College")
            self.assertEqual(cfg.city, "Mumbai")
            self.assertTrue(cfg.is_configured)

            # Verify station was loaded
            station = CollectionPoint.objects.get(station_code="SEC-ENG-F01")
            self.assertEqual(station.building, "Engineering Building")
            self.assertEqual(station.map_link, "https://maps.google.com/?q=Gate1")
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
