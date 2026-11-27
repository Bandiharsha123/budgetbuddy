from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model

from rest_framework.test import APIClient
from rest_framework import status

from apps.expenses.models import Expense


User = get_user_model()


class ExpenseAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()

        # Create User A
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="TestPass123!"
        )

        # Create User B
        self.another_user = User.objects.create_user(
            username="anotheruser",
            email="another@example.com",
            password="TestPass123!"
        )

        # Expense belonging to User A
        self.expense = Expense.objects.create(
            user=self.user,
            amount=500,
            category="FOOD",
            date=date(2026, 11, 25),
            description="Lunch"
        )

        # Expense belonging to User B
        self.another_expense = Expense.objects.create(
            user=self.another_user,
            amount=1000,
            category="TRAVEL",
            date=date(2026, 11, 25),
            description="Bus ticket"
        )

        self.url = "/api/expenses/"

        self.valid_data = {
            "amount": "750.00",
            "category": "FOOD",
            "date": "2026-11-25",
            "description": "Dinner"
        }

    # -----------------------------------
    # 1. AUTHENTICATION TESTS
    # -----------------------------------

    def test_unauthenticated_user_cannot_view_expenses(self):

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED
        )

    def test_authenticated_user_can_view_expenses(self):

        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK
        )

    def test_unauthenticated_user_cannot_create_expense(self):

        response = self.client.post(
            self.url,
            self.valid_data,
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED
        )

    # -----------------------------------
    # 2. CREATE EXPENSE TESTS
    # -----------------------------------

    def test_user_can_create_expense(self):

        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url,
            self.valid_data,
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED
        )

        self.assertTrue(
            Expense.objects.filter(
                user=self.user,
                description="Dinner"
            ).exists()
        )

    def test_expense_is_assigned_to_logged_in_user(self):

        self.client.force_authenticate(user=self.user)

        data = {
            **self.valid_data,
            "user": self.another_user.id
        }

        response = self.client.post(
            self.url,
            data,
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED
        )

        created_expense = Expense.objects.get(
            description="Dinner"
        )

        self.assertEqual(created_expense.user, self.user)

    def test_zero_amount_is_rejected(self):

        self.client.force_authenticate(user=self.user)

        data = {
            **self.valid_data,
            "amount": "0"
        }

        response = self.client.post(
            self.url,
            data,
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST
        )

    def test_negative_amount_is_rejected(self):

        self.client.force_authenticate(user=self.user)

        data = {
            **self.valid_data,
            "amount": "-100"
        }

        response = self.client.post(
            self.url,
            data,
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST
        )

    def test_invalid_category_is_rejected(self):

        self.client.force_authenticate(user=self.user)

        data = {
            **self.valid_data,
            "category": "INVALID_CATEGORY"
        }

        response = self.client.post(
            self.url,
            data,
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST
        )

    def test_missing_date_is_rejected(self):

        self.client.force_authenticate(user=self.user)

        data = self.valid_data.copy()
        data.pop("date")

        response = self.client.post(
            self.url,
            data,
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST
        )

    # -----------------------------------
    # 3. RETRIEVE EXPENSE TESTS
    # -----------------------------------

    def test_user_can_retrieve_own_expense(self):

        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.expense.id}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK
        )

    def test_user_cannot_retrieve_another_users_expense(self):

        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"{self.url}{self.another_expense.id}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND
        )

    # -----------------------------------
    # 4. UPDATE EXPENSE TESTS
    # -----------------------------------

    def test_user_can_update_own_expense(self):

        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            f"{self.url}{self.expense.id}/",
            {"amount": "900.00"},
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK
        )

        self.expense.refresh_from_db()

        self.assertEqual(
            self.expense.amount,
            Decimal("900.00")
        )

    def test_user_cannot_update_another_users_expense(self):

        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            f"{self.url}{self.another_expense.id}/",
            {"amount": "2000.00"},
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND
        )

    # -----------------------------------
    # 5. DELETE EXPENSE TESTS
    # -----------------------------------

    def test_user_can_delete_own_expense(self):

        self.client.force_authenticate(user=self.user)

        response = self.client.delete(
            f"{self.url}{self.expense.id}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT
        )

        self.assertFalse(
            Expense.objects.filter(
                id=self.expense.id
            ).exists()
        )

    def test_user_cannot_delete_another_users_expense(self):

        self.client.force_authenticate(user=self.user)

        response = self.client.delete(
            f"{self.url}{self.another_expense.id}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND
        )

        self.assertTrue(
            Expense.objects.filter(
                id=self.another_expense.id
            ).exists()
        )

    # -----------------------------------
    # 6. USER DATA ISOLATION TEST
    # -----------------------------------

    def test_user_can_only_view_own_expenses(self):

        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK
        )

        results = (
            response.data["results"]
            if isinstance(response.data, dict)
            else response.data
        )

        expense_ids = [
            item["id"] for item in results
        ]

        self.assertIn(
            self.expense.id,
            expense_ids
        )

        self.assertNotIn(
            self.another_expense.id,
            expense_ids
        )