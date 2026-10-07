from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from .models import User

class AccountsAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_signup_with_email_success(self):
        resp = self.client.post('/api/auth/signup/', {
            'name': 'Student One',
            'email': 'student1@anydomain.com',
            'password': 'password123',
            'password_confirm': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', resp.data)
        self.assertEqual(resp.data['user']['email'], 'student1@anydomain.com')
        self.assertEqual(resp.data['user']['role'], 'student')

    def test_signup_with_mobile_only_success(self):
        resp = self.client.post('/api/auth/signup/', {
            'name': 'Student Two',
            'mobile_number': '9876543210',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', resp.data)
        self.assertEqual(resp.data['user']['mobile_number'], '9876543210')

    def test_signup_requires_at_least_one_identifier(self):
        resp = self.client.post('/api/auth/signup/', {
            'name': 'No Identifier',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', resp.data)

    def test_signup_password_mismatch(self):
        resp = self.client.post('/api/auth/signup/', {
            'name': 'Mismatch User',
            'email': 'mismatch@example.com',
            'password': 'password123',
            'password_confirm': 'different123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_with_email(self):
        User.objects.create_user(email='testlogin@example.com', password='password123', name='Login User')
        resp = self.client.post('/api/auth/login/', {
            'identifier': 'testlogin@example.com',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('token', resp.data)

    def test_login_with_mobile(self):
        User.objects.create_user(mobile_number='9998887776', password='password123', name='Mobile User')
        resp = self.client.post('/api/auth/login/', {
            'identifier': '9998887776',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('token', resp.data)

    def test_me_and_logout(self):
        user = User.objects.create_user(email='me_user@example.com', password='password123', name='Me User')
        self.client.force_authenticate(user=user)
        me_resp = self.client.get('/api/auth/me/')
        self.assertEqual(me_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(me_resp.data['email'], 'me_user@example.com')

        logout_resp = self.client.post('/api/auth/logout/')
        self.assertEqual(logout_resp.status_code, status.HTTP_200_OK)
