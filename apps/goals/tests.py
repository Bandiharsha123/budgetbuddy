from django.test import TestCase

# Create your tests here.
from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model

from rest_framework.test import APIClient
from rest_framework import status

from apps.goals.models import SavingsGoal

User = get_user_model()


class SavingsGoalAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="TestPass123!"
        )

        self.another_user = User.objects.create_user(
            username="anotheruser",
            email="another@example.com",
            password="TestPass123!"
        )

        self.goal = SavingsGoal.objects.create(
            user=self.user,
            title="Buy Laptop",
            target_amount=Decimal("60000.00"),
            current_amount=Decimal("20000.00"),
            target_date=date(2027, 6, 30)
        )

        self.another_goal = SavingsGoal.objects.create(
            user=self.another_user,
            title="Buy Bike",
            target_amount=Decimal("100000.00"),
            current_amount=Decimal("30000.00"),
            target_date=date(2027, 12, 31)
        )

        self.url = "/api/goals/"

        self.valid_data = {
            "title": "Emergency Fund",
            "target_amount": "50000.00",
            "current_amount": "5000.00",
            "target_date": "2027-12-31"
        }

    # 1. AUTHENTICATION

    def test_unauthenticated_user_cannot_view_goals(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_view_goals(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_user_cannot_create_goal(self):
        response = self.client.post(
            self.url, self.valid_data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # 2. CREATE

    def test_user_can_create_goal(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url, self.valid_data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.assertTrue(
            SavingsGoal.objects.filter(
                user=self.user,
                title="Emergency Fund"
            ).exists()
        )

    def test_goal_belongs_to_logged_in_user(self):
        self.client.force_authenticate(user=self.user)

        data = {
            **self.valid_data,
            "user": self.another_user.id
        }

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        goal = SavingsGoal.objects.get(title="Emergency Fund")

        self.assertEqual(goal.user, self.user)

    # 3. VALIDATION

    def test_zero_target_amount_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {**self.valid_data, "target_amount": "0"}

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_target_amount_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {**self.valid_data, "target_amount": "-500"}

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_current_amount_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {**self.valid_data, "current_amount": "-100"}

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_title_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = self.valid_data.copy()
        data.pop("title")

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_target_date_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = self.valid_data.copy()
        data.pop("target_date")

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # 4. RETRIEVE

    def test_user_can_retrieve_own_goal(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.goal.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user_cannot_retrieve_another_users_goal(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.another_goal.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 5. UPDATE

    def test_user_can_update_own_goal(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            f"{self.url}{self.goal.id}/",
            {"title": "New Laptop"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.goal.refresh_from_db()

        self.assertEqual(self.goal.title, "New Laptop")

    def test_user_cannot_update_another_users_goal(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            f"{self.url}{self.another_goal.id}/",
            {"title": "Modified Goal"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 6. DELETE

    def test_user_can_delete_own_goal(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(
            f"{self.url}{self.goal.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.assertFalse(
            SavingsGoal.objects.filter(id=self.goal.id).exists()
        )

    def test_user_cannot_delete_another_users_goal(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(
            f"{self.url}{self.another_goal.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.assertTrue(
            SavingsGoal.objects.filter(id=self.another_goal.id).exists()
        )

    # 7. DEPOSIT

    def test_user_can_deposit_money(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"{self.url}{self.goal.id}/deposit/",
            {"amount": "5000.00"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.goal.refresh_from_db()

        self.assertEqual(
            self.goal.current_amount,
            Decimal("25000.00")
        )

    def test_zero_deposit_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"{self.url}{self.goal.id}/deposit/",
            {"amount": "0"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_deposit_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"{self.url}{self.goal.id}/deposit/",
            {"amount": "-500"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_deposit_amount_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"{self.url}{self.goal.id}/deposit/",
            {},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_cannot_deposit_into_another_users_goal(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"{self.url}{self.another_goal.id}/deposit/",
            {"amount": "5000"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 8. FINANCIAL CALCULATIONS

    def test_remaining_amount_calculation(self):
        self.assertEqual(
            self.goal.remaining_amount,
            Decimal("40000.00")
        )

    def test_progress_percentage_calculation(self):
        self.assertEqual(
            self.goal.progress_percentage,
            33.33
        )

    def test_goal_completion_status(self):
        self.assertFalse(self.goal.is_completed)

        self.goal.current_amount = Decimal("60000.00")
        self.goal.save()

        self.goal.refresh_from_db()

        self.assertTrue(self.goal.is_completed)

    # 9. DATA ISOLATION

    def test_user_can_only_view_own_goals(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = (
            response.data["results"]
            if isinstance(response.data, dict)
            else response.data
        )

        goal_ids = [item["id"] for item in results]

        self.assertIn(self.goal.id, goal_ids)
        self.assertNotIn(self.another_goal.id, goal_ids)