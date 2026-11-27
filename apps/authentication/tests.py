from django.test import TestCase

# Create your tests here.
import re

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core import mail

from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class AuthenticationTestBase(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="TestPass123!",
            role="STUDENT"
        )

        self.admin = User.objects.create_user(
            username="adminuser",
            email="admin@example.com",
            password="AdminPass123!",
            role="ADMIN"
        )

        self.auth_url = "/api/auth/"


# ==================================================
# 1. REGISTRATION TESTS
# ==================================================

class RegistrationTests(AuthenticationTestBase):

    def test_user_can_register(self):
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "NewPass123!"
        }

        response = self.client.post(
            self.auth_url + "register/",
            data,
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        new_user = User.objects.get(username="newuser")

        self.assertEqual(new_user.role, "STUDENT")
        self.assertTrue(new_user.check_password("NewPass123!"))

    def test_duplicate_username_is_rejected(self):
        data = {
            "username": "testuser",
            "email": "different@example.com",
            "password": "NewPass123!"
        }

        response = self.client.post(
            self.auth_url + "register/",
            data,
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_short_password_is_rejected(self):
        data = {
            "username": "shortuser",
            "email": "short@example.com",
            "password": "123"
        }

        response = self.client.post(
            self.auth_url + "register/",
            data,
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_without_username_is_rejected(self):
        data = {
            "email": "missing@example.com",
            "password": "NewPass123!"
        }

        response = self.client.post(
            self.auth_url + "register/",
            data,
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_cannot_assign_admin_role(self):
        data = {
            "username": "normaluser",
            "email": "normal@example.com",
            "password": "NewPass123!",
            "role": "ADMIN"
        }

        response = self.client.post(
            self.auth_url + "register/",
            data,
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        new_user = User.objects.get(username="normaluser")

        self.assertEqual(new_user.role, "STUDENT")


# ==================================================
# 2. LOGIN AND JWT TESTS
# ==================================================

class LoginTests(AuthenticationTestBase):

    def test_login_with_valid_credentials(self):
        data = {
            "username": "testuser",
            "password": "TestPass123!"
        }

        response = self.client.post(
            self.auth_url + "login/",
            data,
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_with_wrong_password(self):
        data = {
            "username": "testuser",
            "password": "WrongPassword123!"
        }

        response = self.client.post(
            self.auth_url + "login/",
            data,
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_with_unknown_username(self):
        data = {
            "username": "unknownuser",
            "password": "TestPass123!"
        }

        response = self.client.post(
            self.auth_url + "login/",
            data,
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token(self):
        login_response = self.client.post(
            self.auth_url + "login/",
            {
                "username": "testuser",
                "password": "TestPass123!"
            },
            format="json"
        )

        refresh_token = login_response.data["refresh"]

        response = self.client.post(
            self.auth_url + "token/refresh/",
            {"refresh": refresh_token},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)


# ==================================================
# 3. PROFILE TESTS
# ==================================================

class ProfileTests(AuthenticationTestBase):

    def test_unauthenticated_user_cannot_view_profile(self):
        response = self.client.get(
            self.auth_url + "profile/"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_view_profile(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            self.auth_url + "profile/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user_can_update_profile(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.auth_url + "profile/",
            {
                "username": "updateduser",
                "currency": "INR"
            },
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()

        self.assertEqual(self.user.username, "updateduser")

    def test_user_cannot_change_own_role(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.auth_url + "profile/",
            {"role": "ADMIN"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()

        self.assertEqual(self.user.role, "STUDENT")


# ==================================================
# 4. PASSWORD CHANGE TESTS
# ==================================================

class ChangePasswordTests(AuthenticationTestBase):

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)

        self.url = self.auth_url + "change-password/"

    def test_user_can_change_password(self):
        response = self.client.post(
            self.url,
            {
                "current_password": "TestPass123!",
                "new_password": "NewStrongPass123!",
                "confirm_password": "NewStrongPass123!"
            },
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password("NewStrongPass123!")
        )

    def test_incorrect_current_password_is_rejected(self):
        response = self.client.post(
            self.url,
            {
                "current_password": "WrongPassword",
                "new_password": "NewStrongPass123!",
                "confirm_password": "NewStrongPass123!"
            },
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mismatched_passwords_are_rejected(self):
        response = self.client.post(
            self.url,
            {
                "current_password": "TestPass123!",
                "new_password": "NewStrongPass123!",
                "confirm_password": "DifferentPass123!"
            },
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_same_password_is_rejected(self):
        response = self.client.post(
            self.url,
            {
                "current_password": "TestPass123!",
                "new_password": "TestPass123!",
                "confirm_password": "TestPass123!"
            },
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ==================================================
# 5. FORGOT PASSWORD TESTS
# ==================================================

@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="BudgetBuddy <noreply@example.com>",
    FRONTEND_URL="http://localhost:5173"
)
class ForgotPasswordTests(AuthenticationTestBase):

    def setUp(self):
        super().setUp()
        mail.outbox = []

        self.url = self.auth_url + "forgot-password/"

    def test_registered_email_receives_reset_email(self):
        response = self.client.post(
            self.url,
            {"email": "test@example.com"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        self.assertIn(
            "Reset Your Password",
            mail.outbox[0].subject
        )

    def test_unknown_email_returns_generic_response(self):
        response = self.client.post(
            self.url,
            {"email": "unknown@example.com"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

        self.assertIn(
            "If an account exists",
            response.data["detail"]
        )

    def test_empty_email_is_rejected(self):
        response = self.client.post(
            self.url,
            {"email": ""},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ==================================================
# 6. RESET PASSWORD TESTS
# ==================================================

@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="BudgetBuddy <noreply@example.com>",
    FRONTEND_URL="http://localhost:5173"
)
class ResetPasswordTests(AuthenticationTestBase):

    def setUp(self):
        super().setUp()
        mail.outbox = []

        self.forgot_url = self.auth_url + "forgot-password/"
        self.reset_url = self.auth_url + "reset-password/"

        self.client.post(
            self.forgot_url,
            {"email": "test@example.com"},
            format="json"
        )

        email_body = mail.outbox[0].body

        match = re.search(
            r"/reset-password/([^/\s]+)/([^/\s]+)",
            email_body
        )

        self.assertIsNotNone(match)

        self.uid = match.group(1)
        self.token = match.group(2)

    def test_user_can_reset_password(self):
        response = self.client.post(
            self.reset_url,
            {
                "uid": self.uid,
                "token": self.token,
                "new_password": "BrandNewPass123!",
                "confirm_password": "BrandNewPass123!"
            },
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password("BrandNewPass123!")
        )

    def test_invalid_token_is_rejected(self):
        response = self.client.post(
            self.reset_url,
            {
                "uid": self.uid,
                "token": "invalid-token",
                "new_password": "BrandNewPass123!",
                "confirm_password": "BrandNewPass123!"
            },
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mismatched_passwords_are_rejected(self):
        response = self.client.post(
            self.reset_url,
            {
                "uid": self.uid,
                "token": self.token,
                "new_password": "BrandNewPass123!",
                "confirm_password": "DifferentPass123!"
            },
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ==================================================
# 7. ADMIN PERMISSION TESTS
# ==================================================

class AdminPermissionTests(AuthenticationTestBase):

    def test_student_cannot_access_admin_user_list(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            self.auth_url + "admin/users/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_access_user_list(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(
            self.auth_url + "admin/users/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn("stats", response.data)
        self.assertIn("users", response.data)

    def test_admin_can_change_another_users_role(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.auth_url + f"admin/users/{self.user.id}/",
            {"role": "PREMIUM"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()

        self.assertEqual(self.user.role, "PREMIUM")

    def test_admin_cannot_modify_own_role(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            self.auth_url + f"admin/users/{self.admin.id}/",
            {"role": "STUDENT"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)