from django.test import TestCase

# Create your tests here.
from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model

from rest_framework.test import APIClient
from rest_framework import status

from apps.incomes.models import Income

User = get_user_model()


class IncomeAPITest(TestCase):

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

        self.income = Income.objects.create(
            user=self.user,
            amount=5000,
            source="POCKET_MONEY",
            date=date(2026, 11, 25),
            description="Monthly pocket money"
        )

        self.another_income = Income.objects.create(
            user=self.another_user,
            amount=10000,
            source="SCHOLARSHIP",
            date=date(2026, 11, 25),
            description="Scholarship payment"
        )

        self.url = "/api/incomes/"

        self.valid_data = {
            "amount": "7500.00",
            "source": "FREELANCE",
            "date": "2026-11-25",
            "description": "Freelance project"
        }

    # 1. AUTHENTICATION

    def test_unauthenticated_user_cannot_view_income(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_view_income(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_user_cannot_create_income(self):
        response = self.client.post(
            self.url, self.valid_data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # 2. CREATE

    def test_user_can_create_income(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url, self.valid_data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Income.objects.filter(
                user=self.user,
                description="Freelance project"
            ).exists()
        )

    def test_income_belongs_to_logged_in_user(self):
        self.client.force_authenticate(user=self.user)

        data = {
            **self.valid_data,
            "user": self.another_user.id
        }

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created_income = Income.objects.get(
            description="Freelance project"
        )

        self.assertEqual(created_income.user, self.user)

    # 3. VALIDATION

    def test_zero_amount_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {**self.valid_data, "amount": "0"}

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_amount_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {**self.valid_data, "amount": "-500"}

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_source_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {**self.valid_data, "source": "INVALID_SOURCE"}

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_date_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = self.valid_data.copy()
        data.pop("date")

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # 4. RETRIEVE

    def test_user_can_retrieve_own_income(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.income.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user_cannot_retrieve_another_users_income(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.another_income.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 5. UPDATE

    def test_user_can_update_own_income(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            f"{self.url}{self.income.id}/",
            {"amount": "9000.00"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.income.refresh_from_db()

        self.assertEqual(
            self.income.amount,
            Decimal("9000.00")
        )

    def test_user_cannot_update_another_users_income(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            f"{self.url}{self.another_income.id}/",
            {"amount": "20000.00"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 6. DELETE

    def test_user_can_delete_own_income(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(
            f"{self.url}{self.income.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.assertFalse(
            Income.objects.filter(id=self.income.id).exists()
        )

    def test_user_cannot_delete_another_users_income(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(
            f"{self.url}{self.another_income.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.assertTrue(
            Income.objects.filter(id=self.another_income.id).exists()
        )

    # 7. DATA ISOLATION

    def test_user_can_only_view_own_income(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = (
            response.data["results"]
            if isinstance(response.data, dict)
            else response.data
        )

        income_ids = [item["id"] for item in results]

        self.assertIn(self.income.id, income_ids)
        self.assertNotIn(self.another_income.id, income_ids)