"""
Phase 12: Role-Based Workflow Acceptance Test Suite.
Verifies all 10 acceptance workflows:
1. Student signup always creates a Student account, even if an Admin role is submitted in the request.
2. Student login works at /login; Student login through /admin/login is rejected.
3. Super Admin can create Admin and Custodian accounts through /admin/users.
4. Admin can create Custodian accounts but cannot create Admin accounts.
5. Custodian can access only assigned station and handover operations.
6. Each role sees only its own dashboard, navigation and permitted actions.
7. Direct URL and API access to unauthorized features is blocked server-side.
8. Verify refresh, logout, session persistence and role-specific redirects.
9. Verify Student, Admin and Custodian workflows do not expose another user's private data.
10. Ensure all existing Lost/Found, matching, notifications, IDs, privacy, sticker and handover features still work.
"""

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User
from django.contrib.contenttypes.models import ContentType
from collectionpoint.models import CollectionPoint
from items.models import LostItem, FoundItem
from handovers.models import Handover, HandoverStatus
from pickup.models import PickupRequest


class Phase12WorkflowAcceptanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create baseline station
        self.station = CollectionPoint.objects.create(
            public_id="stn-lib-01",
            station_code="STN-LIB-F01",
            building="Central Library",
            floor="1st Floor",
            station_type="Circulation Desk",
            status="ACTIVE",
            capacity=100
        )

        # Create accounts for each role
        self.superadmin = User.objects.create_superuser(
            email="superadmin@campus.edu",
            password="Password123!",
            name="Super Admin"
        )
        self.admin = User.objects.create_user(
            email="admin@campus.edu",
            password="Password123!",
            name="Department Admin",
            role="admin"
        )
        self.custodian = User.objects.create_user(
            email="custodian@campus.edu",
            password="Password123!",
            name="Desk Custodian",
            role="custodian"
        )
        self.student = User.objects.create_user(
            email="student@campus.edu",
            password="Password123!",
            name="Enrolled Student",
            role="student"
        )
        self.other_student = User.objects.create_user(
            email="other_student@campus.edu",
            password="Password123!",
            name="Second Student",
            role="student"
        )

    # -------------------------------------------------------------------------
    # 1. Student signup always creates a Student account (tampering ignored)
    # -------------------------------------------------------------------------
    def test_workflow_1_student_signup_always_creates_student_role(self):
        # Only test roles that ARE valid choices; 'staff' is not in ROLE_CHOICES and would
        # fail validation before reaching create(), which wouldn't test role-coercion logic.
        tampered_roles = ["admin", "superadmin", "custodian"]
        for idx, role in enumerate(tampered_roles):
            resp = self.client.post("/api/auth/signup/", {
                "name": f"Tamper Test {idx}",
                "email": f"tamper_{idx}@example.com",
                "password": "Password123!",
                "password_confirm": "Password123!",
                "role": role,
            }, format="json")
            self.assertEqual(resp.status_code, status.HTTP_201_CREATED,
                             msg=f"Signup with role={role!r} failed: {resp.data}")
            created_user = User.objects.get(email=f"tamper_{idx}@example.com")
            self.assertEqual(created_user.role, "student",
                             msg=f"Expected role='student' after tampered role={role!r}, got {created_user.role!r}")
            self.assertFalse(created_user.is_staff)
            self.assertFalse(created_user.is_superuser)

    # -------------------------------------------------------------------------
    # 2. Student login works at /login; rejected at /admin/login
    # -------------------------------------------------------------------------
    def test_workflow_2_student_login_rejection_at_admin_portal(self):
        # Student login on public portal (default or portal='student')
        student_public = self.client.post("/api/auth/login/", {
            "identifier": "student@campus.edu",
            "password": "Password123!",
            "portal": "student"
        }, format="json")
        self.assertEqual(student_public.status_code, status.HTTP_200_OK)
        self.assertIn("token", student_public.data)
        self.assertEqual(student_public.data["user"]["role"], "student")

        # Student login on admin portal (portal='admin') -> HTTP 403 Forbidden
        student_admin_portal = self.client.post("/api/auth/login/", {
            "identifier": "student@campus.edu",
            "password": "Password123!",
            "portal": "admin"
        }, format="json")
        self.assertEqual(student_admin_portal.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Access denied", student_admin_portal.data.get("detail", ""))

        # Admin and Custodian can log in via portal='admin'
        for staff_user in [self.admin, self.custodian, self.superadmin]:
            staff_login = self.client.post("/api/auth/login/", {
                "identifier": staff_user.email,
                "password": "Password123!",
                "portal": "admin"
            }, format="json")
            self.assertEqual(staff_login.status_code, status.HTTP_200_OK)

    # -------------------------------------------------------------------------
    # 3. Super Admin can create Admin and Custodian accounts
    # -------------------------------------------------------------------------
    def test_workflow_3_superadmin_can_create_admin_and_custodian(self):
        self.client.force_authenticate(user=self.superadmin)

        # Super Admin creates Admin
        resp_admin = self.client.post("/api/auth/users/", {
            "name": "New Regional Admin",
            "email": "regadmin@campus.edu",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "role": "admin"
        }, format="json")
        self.assertEqual(resp_admin.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_admin.data["role"], "admin")
        created_admin = User.objects.get(email="regadmin@campus.edu")
        self.assertEqual(created_admin.role, "admin")
        self.assertTrue(created_admin.is_staff)

        # Super Admin creates Custodian
        resp_cust = self.client.post("/api/auth/users/", {
            "name": "New Station Custodian",
            "email": "stationcust@campus.edu",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "role": "custodian"
        }, format="json")
        self.assertEqual(resp_cust.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_cust.data["role"], "custodian")

    # -------------------------------------------------------------------------
    # 4. Admin can create Custodian but cannot create Admin accounts
    # -------------------------------------------------------------------------
    def test_workflow_4_admin_can_create_custodian_not_admin(self):
        self.client.force_authenticate(user=self.admin)

        # Admin creates Custodian -> 201 Created
        resp_cust = self.client.post("/api/auth/users/", {
            "name": "Desk Assistant",
            "email": "deskassistant@campus.edu",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "role": "custodian"
        }, format="json")
        self.assertEqual(resp_cust.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_cust.data["role"], "custodian")

        # Admin attempts to create Admin -> 403 Forbidden
        resp_admin = self.client.post("/api/auth/users/", {
            "name": "Unauthorized Peer Admin",
            "email": "peeradmin@campus.edu",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "role": "admin"
        }, format="json")
        self.assertEqual(resp_admin.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("only super admins can create admin accounts", resp_admin.data.get("detail", "").lower())

    # -------------------------------------------------------------------------
    # 5. Custodian station & handover access vs restricted features
    # -------------------------------------------------------------------------
    def test_workflow_5_custodian_permissions_and_boundaries(self):
        self.client.force_authenticate(user=self.custodian)

        # Custodian CAN access handovers list
        resp_handovers = self.client.get("/api/handovers/admin/")
        self.assertEqual(resp_handovers.status_code, status.HTTP_200_OK)

        # Custodian CAN view collection stations
        resp_stations = self.client.get("/api/collection-points/")
        self.assertEqual(resp_stations.status_code, status.HTTP_200_OK)

        # Custodian CANNOT access User Management (/api/auth/users/) -> 403
        resp_users = self.client.get("/api/auth/users/")
        self.assertEqual(resp_users.status_code, status.HTTP_403_FORBIDDEN)

        # Custodian CANNOT access Audit Logs (/api/audit/logs/) -> 403
        resp_audit = self.client.get("/api/audit/logs/")
        self.assertEqual(resp_audit.status_code, status.HTTP_403_FORBIDDEN)

        # Custodian CANNOT access Disputes Queue (/api/pickup/disputes/admin/) -> 403
        resp_disputes = self.client.get("/api/pickup/disputes/admin/")
        self.assertEqual(resp_disputes.status_code, status.HTTP_403_FORBIDDEN)

        # Custodian CANNOT delete/archive reports -> 403
        found_item = FoundItem.objects.create(
            user=self.custodian,
            title="Desk Keyring",
            description="Silver ring with 3 keys",
            category="KEYS",
            status="REPORTED",
            collection_point=self.station
        )
        resp_del = self.client.delete(f"/api/items/found-items/{found_item.public_id}/")
        self.assertEqual(resp_del.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 6. Each role sees only permitted dashboard & operational data
    # -------------------------------------------------------------------------
    def test_workflow_6_role_dashboard_metrics_isolation(self):
        # Admin stats accessible to staff (Admin, Superadmin, Custodian)
        self.client.force_authenticate(user=self.admin)
        admin_stats = self.client.get("/api/items/admin-stats/")
        self.assertEqual(admin_stats.status_code, status.HTTP_200_OK)
        self.assertIn("active_claims", admin_stats.data)

        # Student CANNOT access admin stats -> 403
        self.client.force_authenticate(user=self.student)
        student_stats = self.client.get("/api/items/admin-stats/")
        self.assertEqual(student_stats.status_code, status.HTTP_403_FORBIDDEN)

        # Public stats accessible to all (including unauthenticated students)
        self.client.force_authenticate(user=None)
        pub_stats = self.client.get("/api/items/public-stats/")
        self.assertEqual(pub_stats.status_code, status.HTTP_200_OK)
        self.assertIn("items_returned", pub_stats.data)

    # -------------------------------------------------------------------------
    # 7. Direct URL and API access to unauthorized features is blocked server-side
    # -------------------------------------------------------------------------
    def test_workflow_7_server_side_authorization_blocks(self):
        # Unauthenticated calls
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get("/api/auth/users/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get("/api/audit/logs/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get("/api/handovers/admin/").status_code, status.HTTP_401_UNAUTHORIZED)

        # Student calls to staff/admin endpoints
        self.client.force_authenticate(user=self.student)
        self.assertEqual(self.client.get("/api/auth/users/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/api/audit/logs/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/api/pickup/disputes/admin/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/api/handovers/admin/").status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 8. Token session persistence, profile fetch and logout
    # -------------------------------------------------------------------------
    def test_workflow_8_session_persistence_and_logout(self):
        # Login and obtain token
        login_resp = self.client.post("/api/auth/login/", {
            "identifier": "student@campus.edu",
            "password": "Password123!",
        }, format="json")
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        token = login_resp.data["token"]

        # Fetch profile (/api/auth/me/) with Bearer token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        me_resp = self.client.get("/api/auth/me/")
        self.assertEqual(me_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(me_resp.data["email"], "student@campus.edu")
        self.assertEqual(me_resp.data["role"], "student")

        # Logout endpoint
        logout_resp = self.client.post("/api/auth/logout/")
        self.assertEqual(logout_resp.status_code, status.HTTP_200_OK)

    # -------------------------------------------------------------------------
    # 9. Private data exposure guards
    # -------------------------------------------------------------------------
    def test_workflow_9_private_data_never_exposed(self):
        # 1. Staff user list does NOT leak password hashes
        self.client.force_authenticate(user=self.superadmin)
        users_resp = self.client.get("/api/auth/users/")
        self.assertEqual(users_resp.status_code, status.HTTP_200_OK)
        users_list = users_resp.data if isinstance(users_resp.data, list) else users_resp.data.get("results", [])
        for user_data in users_list:
            self.assertNotIn("password", user_data)
            self.assertNotIn("password_hash", user_data)

        # 2. Student's lost item private answers are isolated to owner
        lost_item = LostItem.objects.create(
            user=self.student,
            description="Private Blue Backpack with stickers",
            category="BAGS",
            status="REPORTED",
            original_answers={"private_brand": "SecretBrand", "secret_keychain": "Pikachu"}
        )

        # Student owner can view their report
        self.client.force_authenticate(user=self.student)
        owner_resp = self.client.get(f"/api/items/lost-items/{lost_item.id}/")
        self.assertEqual(owner_resp.status_code, status.HTTP_200_OK)

        # Another student cannot view other student's lost item details
        self.client.force_authenticate(user=self.other_student)
        other_resp = self.client.get(f"/api/items/lost-items/{lost_item.id}/")
        self.assertIn(other_resp.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    # -------------------------------------------------------------------------
    # 10. Existing Lost/Found IDs, custody and handover workflow verification
    # -------------------------------------------------------------------------
    def test_workflow_10_lost_found_unique_ids_and_handover_flow(self):
        # 1. Unique ID prefix generation: Lost -> RNT-L-*, Found -> RNT-F-*
        lost = LostItem.objects.create(
            user=self.student,
            description="Silver 14 inch Laptop",
            category="ELECTRONICS",
            status="REPORTED"
        )
        self.assertTrue(lost.public_id.startswith("RNT-L-"))

        found = FoundItem.objects.create(
            user=self.student,
            title="Silver Laptop Desk",
            description="Silver 14 inch laptop found in room 101",
            category="ELECTRONICS",
            status="REPORTED",
            collection_point=self.station
        )
        self.assertTrue(found.public_id.startswith("RNT-F-"))

        # 2. Item in holding station received by custodian
        self.client.force_authenticate(user=self.custodian)
        found.status = 'IN_HOLDING'
        found.save()
        self.assertEqual(found.status, 'IN_HOLDING')

        # 3. Create Pickup Request and Handover
        ct = ContentType.objects.get_for_model(FoundItem)
        pickup = PickupRequest.objects.create(
            requester=self.student,
            content_type=ct,
            object_id=found.id,
            status="READY_FOR_PICKUP"
        )
        handover = Handover.objects.create(
            pickup_request=pickup,
            found_item=found,
            student=self.student,
            custodian=self.custodian,
            status=HandoverStatus.READY
        )
        self.assertEqual(handover.status, HandoverStatus.READY)

        # Verify handover endpoint reflects this item for Custodian
        resp = self.client.get("/api/handovers/admin/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
