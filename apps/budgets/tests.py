from django.test import TestCase

# Create your tests here.
from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model

from rest_framework.test import APIClient
from rest_framework import status

from apps.budgets.models import Budget
from apps.expenses.models import Expense

User = get_user_model()


class BudgetAPITest(TestCase):

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

        self.budget = Budget.objects.create(
            user=self.user,
            category="FOOD",
            monthly_limit=Decimal("10000.00"),
            month=11,
            year=2026
        )

        self.another_budget = Budget.objects.create(
            user=self.another_user,
            category="TRAVEL",
            monthly_limit=Decimal("5000.00"),
            month=11,
            year=2026
        )

        self.url = "/api/budgets/"

        self.valid_data = {
            "category": "TRAVEL",
            "monthly_limit": "8000.00",
            "month": 12,
            "year": 2026
        }

    # 1. AUTHENTICATION TESTS

    def test_unauthenticated_user_cannot_view_budgets(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_view_budgets(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_user_cannot_create_budget(self):
        response = self.client.post(
            self.url, self.valid_data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # 2. CREATE TESTS

    def test_user_can_create_budget(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url, self.valid_data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.assertTrue(
            Budget.objects.filter(
                user=self.user,
                category="TRAVEL",
                month=12,
                year=2026
            ).exists()
        )

    def test_budget_is_assigned_to_logged_in_user(self):
        self.client.force_authenticate(user=self.user)

        data = {
            **self.valid_data,
            "user": self.another_user.id
        }

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        budget = Budget.objects.get(
            user=self.user,
            category="TRAVEL",
            month=12,
            year=2026
        )

        self.assertEqual(budget.user, self.user)

    # 3. VALIDATION TESTS

    def test_zero_monthly_limit_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {**self.valid_data, "monthly_limit": "0"}

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_monthly_limit_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {**self.valid_data, "monthly_limit": "-500"}

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_month_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {**self.valid_data, "month": 13}

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_category_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {**self.valid_data, "category": "INVALID"}

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_budget_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        data = {
            "category": "FOOD",
            "monthly_limit": "12000.00",
            "month": 11,
            "year": 2026
        }

        response = self.client.post(
            self.url, data, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # 4. RETRIEVE TESTS

    def test_user_can_retrieve_own_budget(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.budget.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user_cannot_retrieve_another_users_budget(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.another_budget.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 5. UPDATE TESTS

    def test_user_can_update_own_budget(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            f"{self.url}{self.budget.id}/",
            {"monthly_limit": "15000.00"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.budget.refresh_from_db()

        self.assertEqual(
            self.budget.monthly_limit,
            Decimal("15000.00")
        )

    def test_user_cannot_update_another_users_budget(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            f"{self.url}{self.another_budget.id}/",
            {"monthly_limit": "20000.00"},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 6. DELETE TESTS

    def test_user_can_delete_own_budget(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(
            f"{self.url}{self.budget.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.assertFalse(
            Budget.objects.filter(id=self.budget.id).exists()
        )

    def test_user_cannot_delete_another_users_budget(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(
            f"{self.url}{self.another_budget.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.assertTrue(
            Budget.objects.filter(id=self.another_budget.id).exists()
        )

    # 7. FINANCIAL CALCULATION TESTS

    def test_spent_amount_calculation(self):
        Expense.objects.create(
            user=self.user,
            amount=Decimal("2000.00"),
            category="FOOD",
            date=date(2026, 11, 5)
        )

        Expense.objects.create(
            user=self.user,
            amount=Decimal("3000.00"),
            category="FOOD",
            date=date(2026, 11, 10)
        )

        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.budget.id}/"
        )

        self.assertEqual(
            Decimal(str(response.data["spent_amount"])),
            Decimal("5000.00")
        )

    def test_remaining_amount_calculation(self):
        Expense.objects.create(
            user=self.user,
            amount=Decimal("3000.00"),
            category="FOOD",
            date=date(2026, 11, 5)
        )

        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.budget.id}/"
        )

        self.assertEqual(
            Decimal(str(response.data["remaining_amount"])),
            Decimal("7000.00")
        )

    def test_utilization_percentage_calculation(self):
        Expense.objects.create(
            user=self.user,
            amount=Decimal("5000.00"),
            category="FOOD",
            date=date(2026, 11, 5)
        )

        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.budget.id}/"
        )

        self.assertEqual(
            response.data["utilization_percentage"],
            50.0
        )

    # 8. FILTERING TESTS

    def test_filter_budgets_by_month(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}?month=11"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = (
            response.data["results"]
            if isinstance(response.data, dict)
            else response.data
        )

        self.assertTrue(
            all(item["month"] == 11 for item in results)
        )

    def test_filter_budgets_by_year(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}?year=2026"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = (
            response.data["results"]
            if isinstance(response.data, dict)
            else response.data
        )

        self.assertTrue(
            all(item["year"] == 2026 for item in results)
        )

    # 9. DATA ISOLATION

    def test_user_can_only_view_own_budgets(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = (
            response.data["results"]
            if isinstance(response.data, dict)
            else response.data
        )

        budget_ids = [item["id"] for item in results]

        self.assertIn(self.budget.id, budget_ids)
        self.assertNotIn(self.another_budget.id, budget_ids)