import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Notification

User = get_user_model()

class NotificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email='student1@campus.edu',
            password='password123',
            name='Student One',
            role='student'
        )
        self.user2 = User.objects.create_user(
            email='student2@campus.edu',
            password='password123',
            name='Student Two',
            role='student'
        )

        self.notif1 = Notification.objects.create(
            public_id=str(uuid.uuid4()),
            user=self.user1,
            title='Potential Match Found',
            message='A match was found for your blue bottle.',
            notification_type='MATCH_FOUND',
            read=False
        )
        self.notif2 = Notification.objects.create(
            public_id=str(uuid.uuid4()),
            user=self.user1,
            title='Claim Approved',
            message='Your claim has been approved.',
            notification_type='CLAIM_APPROVED',
            read=False
        )
        self.notif_user2 = Notification.objects.create(
            public_id=str(uuid.uuid4()),
            user=self.user2,
            title='Other User Notif',
            message='Private update for user 2.',
            notification_type='INFO',
            read=False
        )

    def test_unauthenticated_cannot_access_notifications(self):
        """Unauthenticated requests must be rejected with 401 Unauthorized."""
        response = self.client.get('/api/notifications/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_can_list_notifications(self):
        """Authenticated users can retrieve their own notifications ordered by date."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get('/api/notifications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data if isinstance(response.data, list) else response.data.get('results', [])
        self.assertEqual(len(data), 2)
        public_ids = {n['public_id'] for n in data}
        self.assertIn(self.notif1.public_id, public_ids)
        self.assertIn(self.notif2.public_id, public_ids)
        self.assertNotIn(self.notif_user2.public_id, public_ids)

    def test_notification_ownership_isolation(self):
        """User cannot see another user's notifications."""
        self.client.force_authenticate(user=self.user2)
        response = self.client.get('/api/notifications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data if isinstance(response.data, list) else response.data.get('results', [])
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['public_id'], self.notif_user2.public_id)

    def test_mark_notification_read(self):
        """User can mark their own notification as read."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(f'/api/notifications/{self.notif1.public_id}/read/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['read'])

        self.notif1.refresh_from_db()
        self.assertTrue(self.notif1.read)

    def test_mark_notification_read_invalid_id(self):
        """Attempting to mark a non-existent notification returns 404."""
        self.client.force_authenticate(user=self.user1)
        non_existent_id = str(uuid.uuid4())
        response = self.client.post(f'/api/notifications/{non_existent_id}/read/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_mark_other_user_notification_read(self):
        """User cannot mark another user's notification as read (returns 404)."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(f'/api/notifications/{self.notif_user2.public_id}/read/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.notif_user2.refresh_from_db()
        self.assertFalse(self.notif_user2.read)

    def test_mark_all_read(self):
        """User can mark all of their own unread notifications as read at once."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post('/api/notifications/mark-all-read/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.notif1.refresh_from_db()
        self.notif2.refresh_from_db()
        self.assertTrue(self.notif1.read)
        self.assertTrue(self.notif2.read)

        # Other user's notification remains unread
        self.notif_user2.refresh_from_db()
        self.assertFalse(self.notif_user2.read)
