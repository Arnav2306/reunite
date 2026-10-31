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

    def test_signup_cannot_grant_privileged_role(self):
        resp = self.client.post('/api/auth/signup/', {
            'name': 'Hacker Admin',
            'email': 'hacker@example.com',
            'password': 'password123',
            'role': 'admin',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['user']['role'], 'student')
        user = User.objects.get(email='hacker@example.com')
        self.assertEqual(user.role, 'student')

    def test_profile_patch_update(self):
        user = User.objects.create_user(email='profile@example.com', password='password123', name='Original Name')
        self.client.force_authenticate(user=user)

        # Update name and personal email
        resp = self.client.patch('/api/auth/me/', {
            'name': 'Updated Name',
            'personal_email': 'personal@example.com',
            'mobile_number': '9876500000',
            'role': 'admin',  # Attempting to escalate role
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.name, 'Updated Name')
        self.assertEqual(user.personal_email, 'personal@example.com')
        self.assertEqual(user.mobile_number, '9876500000')
        self.assertEqual(user.role, 'student')  # Role must not change

    def test_signup_with_gmail_success(self):
        resp = self.client.post('/api/auth/signup/', {
            'name': 'Gmail Student',
            'email': 'student.alex@gmail.com',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['user']['email'], 'student.alex@gmail.com')
        self.assertEqual(resp.data['user']['personal_email'], 'student.alex@gmail.com')

    def test_signup_with_other_personal_email_success(self):
        resp = self.client.post('/api/auth/signup/', {
            'name': 'Outlook Student',
            'email': 'student.taylor@outlook.com',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['user']['email'], 'student.taylor@outlook.com')

    def test_signup_invalid_phone_format(self):
        resp = self.client.post('/api/auth/signup/', {
            'name': 'Bad Phone',
            'mobile_number': '123',  # Too short
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile_number', resp.data)

    def test_signup_duplicate_email(self):
        User.objects.create_user(email='existing@gmail.com', password='password123', name='Existing')
        resp = self.client.post('/api/auth/signup/', {
            'name': 'Duplicate User',
            'email': 'existing@gmail.com',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', resp.data)

    def test_signup_duplicate_mobile(self):
        User.objects.create_user(mobile_number='9876543210', password='password123', name='Existing Mobile')
        resp = self.client.post('/api/auth/signup/', {
            'name': 'Duplicate Mobile User',
            'mobile_number': '9876543210',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile_number', resp.data)

    def test_login_with_formatted_mobile(self):
        User.objects.create_user(mobile_number='9876543210', password='password123', name='Formatted Mobile')
        # Login with dashes
        resp1 = self.client.post('/api/auth/login/', {'identifier': '987-654-3210', 'password': 'password123'}, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        # Login with spaces
        resp2 = self.client.post('/api/auth/login/', {'identifier': '987 654 3210', 'password': 'password123'}, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        # Login with +91 country code prefix
        resp3 = self.client.post('/api/auth/login/', {'identifier': '+91 9876543210', 'password': 'password123'}, format='json')
        self.assertEqual(resp3.status_code, status.HTTP_200_OK)

    def test_login_with_personal_email(self):
        # User who signed up with mobile and only has personal_email set
        User.objects.create_user(
            email=None,
            personal_email='student.personal@example.com',
            mobile_number='9123456789',
            password='password123',
            name='Personal Email User'
        )
        resp = self.client.post('/api/auth/login/', {
            'identifier': 'student.personal@example.com',
            'password': 'password123',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('token', resp.data)

    def test_password_reset_flow(self):
        user = User.objects.create_user(email='resetme@example.com', password='oldpassword123', name='Reset User')
        # Request reset
        req_resp = self.client.post('/api/auth/password-reset/', {'identifier': 'resetme@example.com'}, format='json')
        self.assertEqual(req_resp.status_code, status.HTTP_200_OK)
        uid = req_resp.data.get('debug_uid')
        token = req_resp.data.get('debug_token')
        self.assertIsNotNone(uid)
        self.assertIsNotNone(token)

        # Confirm reset with mismatched passwords
        bad_resp = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': uid,
            'token': token,
            'new_password': 'newpassword123',
            'new_password_confirm': 'mismatch123',
        }, format='json')
        self.assertEqual(bad_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Confirm reset with valid passwords
        good_resp = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': uid,
            'token': token,
            'new_password': 'newpassword123',
            'new_password_confirm': 'newpassword123',
        }, format='json')
        self.assertEqual(good_resp.status_code, status.HTTP_200_OK)

        # Test login with new password
        login_resp = self.client.post('/api/auth/login/', {
            'identifier': 'resetme@example.com',
            'password': 'newpassword123',
        }, format='json')
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        self.assertIn('token', login_resp.data)

    def test_login_portal_admin_rejects_student(self):
        User.objects.create_user(email='student_portal@example.com', password='password123', name='Student Portal', role='student')
        resp = self.client.post('/api/auth/login/', {
            'identifier': 'student_portal@example.com',
            'password': 'password123',
            'portal': 'admin',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Access denied', resp.data['detail'])

    def test_login_portal_admin_allows_admin_and_custodian(self):
        User.objects.create_user(email='admin_portal@example.com', password='password123', name='Admin Portal', role='admin')
        User.objects.create_user(email='custodian_portal@example.com', password='password123', name='Custodian Portal', role='custodian')

        resp_admin = self.client.post('/api/auth/login/', {
            'identifier': 'admin_portal@example.com',
            'password': 'password123',
            'portal': 'admin',
        }, format='json')
        self.assertEqual(resp_admin.status_code, status.HTTP_200_OK)

        resp_cust = self.client.post('/api/auth/login/', {
            'identifier': 'custodian_portal@example.com',
            'password': 'password123',
            'portal': 'admin',
        }, format='json')
        self.assertEqual(resp_cust.status_code, status.HTTP_200_OK)

    def test_admin_user_endpoint_security(self):
        student = User.objects.create_user(email='student_api@example.com', password='password123', name='Student', role='student')
        custodian = User.objects.create_user(email='custodian_api@example.com', password='password123', name='Custodian', role='custodian')
        admin = User.objects.create_user(email='admin_api@example.com', password='password123', name='Admin', role='admin')
        superadmin = User.objects.create_superuser(email='superadmin_api@example.com', password='password123', name='Superadmin')

        # 1. Unauthenticated cannot access
        resp_unauth = self.client.get('/api/auth/users/')
        self.assertEqual(resp_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Student gets 403
        self.client.force_authenticate(user=student)
        resp_student = self.client.get('/api/auth/users/')
        self.assertEqual(resp_student.status_code, status.HTTP_403_FORBIDDEN)
        resp_student_post = self.client.post('/api/auth/users/', {'name': 'New', 'email': 'new@test.com', 'password': 'pass', 'role': 'custodian'})
        self.assertEqual(resp_student_post.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Custodian gets 403
        self.client.force_authenticate(user=custodian)
        resp_cust = self.client.get('/api/auth/users/')
        self.assertEqual(resp_cust.status_code, status.HTTP_403_FORBIDDEN)
        resp_cust_post = self.client.post('/api/auth/users/', {'name': 'New', 'email': 'new@test.com', 'password': 'pass', 'role': 'custodian'})
        self.assertEqual(resp_cust_post.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Admin cannot create Admin account (only Super Admin can)
        self.client.force_authenticate(user=admin)
        resp_admin_create_admin = self.client.post('/api/auth/users/', {
            'name': 'New Admin',
            'email': 'newadmin@campus.edu',
            'password': 'password123',
            'password_confirm': 'password123',
            'role': 'admin',
        }, format='json')
        self.assertEqual(resp_admin_create_admin.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Admin CAN create Custodian account
        resp_admin_create_cust = self.client.post('/api/auth/users/', {
            'name': 'New Custodian',
            'email': 'newcustodian@campus.edu',
            'password': 'password123',
            'password_confirm': 'password123',
            'role': 'custodian',
        }, format='json')
        self.assertEqual(resp_admin_create_cust.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_admin_create_cust.data['role'], 'custodian')

        # 6. Super Admin CAN create Admin account
        self.client.force_authenticate(user=superadmin)
        resp_super_create_admin = self.client.post('/api/auth/users/', {
            'name': 'Authorized Admin',
            'email': 'authorizedadmin@campus.edu',
            'password': 'password123',
            'password_confirm': 'password123',
            'role': 'admin',
        }, format='json')
        self.assertEqual(resp_super_create_admin.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_super_create_admin.data['role'], 'admin')

        # 7. Super Admin CAN create Custodian account
        resp_super_create_cust = self.client.post('/api/auth/users/', {
            'name': 'Super Custodian',
            'email': 'supercust@campus.edu',
            'password': 'password123',
            'password_confirm': 'password123',
            'role': 'custodian',
        }, format='json')
        self.assertEqual(resp_super_create_cust.status_code, status.HTTP_201_CREATED)

        # 8. Cannot create superadmin or student via this endpoint
        resp_super_bad_role = self.client.post('/api/auth/users/', {
            'name': 'Hacked Super',
            'email': 'hackedsuper@campus.edu',
            'password': 'password123',
            'password_confirm': 'password123',
            'role': 'superadmin',
        }, format='json')
        self.assertEqual(resp_super_bad_role.status_code, status.HTTP_400_BAD_REQUEST)

    def test_createsuperuser_sets_superadmin_role(self):
        su = User.objects.create_superuser(email='cli_superuser@campus.edu', password='password123', name='Root Admin')
        self.assertEqual(su.role, 'superadmin')
        self.assertTrue(su.is_staff)
        self.assertTrue(su.is_superuser)

    def test_role_security_audit_logs_and_disputes(self):
        student = User.objects.create_user(email='student_sec@example.com', password='password123', name='Student Sec', role='student')
        custodian = User.objects.create_user(email='custodian_sec@example.com', password='password123', name='Cust Sec', role='custodian')
        admin = User.objects.create_user(email='admin_sec@example.com', password='password123', name='Admin Sec', role='admin')

        # Audit logs: Student 403, Custodian 403, Admin 200
        self.client.force_authenticate(user=student)
        self.assertEqual(self.client.get('/api/audit/logs/').status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=custodian)
        self.assertEqual(self.client.get('/api/audit/logs/').status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=admin)
        self.assertEqual(self.client.get('/api/audit/logs/').status_code, status.HTTP_200_OK)

        # Disputes queue: Custodian 403, Admin 200
        self.client.force_authenticate(user=custodian)
        self.assertEqual(self.client.get('/api/pickup/disputes/admin/').status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=admin)
        self.assertEqual(self.client.get('/api/pickup/disputes/admin/').status_code, status.HTTP_200_OK)

    def test_superadmin_created_with_admin_id_without_email(self):
        su = User(
            admin_id='RNT-TEST-SU01',
            name='Test Super Admin',
            role='superadmin',
            is_staff=True,
            is_superuser=True,
            is_active=True,
        )
        su.set_password('TestPass123!')
        su.save()
        self.assertEqual(su.admin_id, 'RNT-TEST-SU01')
        self.assertIsNone(su.email)
        self.assertTrue(su.password.startswith('pbkdf2_sha256$'))
        self.assertNotIn('TestPass123!', su.password)

        # Login using admin_id as identifier on portal='admin'
        resp = self.client.post('/api/auth/login/', {
            'identifier': 'RNT-TEST-SU01',
            'password': 'TestPass123!',
            'portal': 'admin'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('token', resp.data)
        self.assertEqual(resp.data['user']['admin_id'], 'RNT-TEST-SU01')
        self.assertEqual(resp.data['user']['role'], 'superadmin')

        # Login with wrong password is rejected
        bad_resp = self.client.post('/api/auth/login/', {
            'identifier': 'RNT-TEST-SU01',
            'password': 'WrongPassword!',
            'portal': 'admin'
        }, format='json')
        self.assertEqual(bad_resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_setup_initial_superadmin_command(self):
        from django.core.management import call_command
        from io import StringIO
        out = StringIO()

        # Run command to create account
        call_command('setup_initial_superadmin', admin_id='RNT-CMD-001', password='CmdPassword123!', stdout=out)
        self.assertIn('[SUCCESS]', out.getvalue())
        user = User.objects.get(admin_id='RNT-CMD-001')
        self.assertEqual(user.role, 'superadmin')
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password('CmdPassword123!'))

        # Run again -> duplicate prevention skips creation
        out_dup = StringIO()
        call_command('setup_initial_superadmin', admin_id='RNT-CMD-001', password='CmdPassword123!', stdout=out_dup)
        self.assertIn('[ALREADY EXISTS]', out_dup.getvalue())



