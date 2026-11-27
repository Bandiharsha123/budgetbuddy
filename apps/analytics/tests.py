from django.test import TestCase

# Create your tests here.
from decimal import Decimal
from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.expenses.models import Expense
from apps.incomes.models import Income
from apps.budgets.models import Budget
from apps.goals.models import SavingsGoal


User = get_user_model()


class AnalyticsAPITests(APITestCase):

    def setUp(self):

        # Create two independent users
        self.user = User.objects.create_user(
            username='analytics_user',
            email='analytics@example.com',
            password='TestPassword123'
        )

        self.other_user = User.objects.create_user(
            username='other_user',
            email='other@example.com',
            password='TestPassword123'
        )

        self.client.force_authenticate(user=self.user)

        # Create income records
        Income.objects.create(
            user=self.user,
            amount=Decimal('50000.00'),
            source='POCKET_MONEY',
            date=date(2026, 11, 5)
        )

        Income.objects.create(
            user=self.user,
            amount=Decimal('10000.00'),
            source='FREELANCE',
            date=date(2026, 10, 10)
        )

        # Create expense records
        Expense.objects.create(
            user=self.user,
            amount=Decimal('5000.00'),
            category='FOOD',
            date=date(2026, 11, 8)
        )

        Expense.objects.create(
            user=self.user,
            amount=Decimal('3000.00'),
            category='TRAVEL',
            date=date(2026, 11, 12)
        )

        Expense.objects.create(
            user=self.user,
            amount=Decimal('2000.00'),
            category='FOOD',
            date=date(2026, 10, 15)
        )

        # Create another user's financial records
        Income.objects.create(
            user=self.other_user,
            amount=Decimal('90000.00'),
            source='OTHER',
            date=date(2026, 11, 5)
        )

        Expense.objects.create(
            user=self.other_user,
            amount=Decimal('40000.00'),
            category='SHOPPING',
            date=date(2026, 11, 8)
        )

        # Create budget
        Budget.objects.create(
            user=self.user,
            category='FOOD',
            monthly_limit=Decimal('10000.00'),
            month=11,
            year=2026
        )

        # Create savings goal
        SavingsGoal.objects.create(
            user=self.user,
            title='New Laptop',
            target_amount=Decimal('50000.00'),
            current_amount=Decimal('20000.00'),
            target_date=date(2027, 6, 30)
        )

        self.base_url = '/api/analytics/'

    # -------------------------------------------------
    # 1. AUTHENTICATION TESTS
    # -------------------------------------------------

    def test_unauthenticated_dashboard_access(self):

        self.client.force_authenticate(user=None)

        response = self.client.get(
            self.base_url + 'dashboard/'
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED
        )

    # -------------------------------------------------
    # 2. DASHBOARD ANALYTICS
    # -------------------------------------------------

    def test_dashboard_analytics(self):

        response = self.client.get(
            self.base_url + 'dashboard/'
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            Decimal(response.data['total_income']),
            Decimal('60000.00')
        )

        self.assertEqual(
            Decimal(response.data['total_expenses']),
            Decimal('10000.00')
        )

        self.assertEqual(
            Decimal(response.data['balance']),
            Decimal('50000.00')
        )

    # -------------------------------------------------
    # 3. MONTHLY ANALYTICS
    # -------------------------------------------------

    def test_monthly_analytics(self):

        response = self.client.get(
            self.base_url + 'monthly/'
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            len(response.data['monthly_data']),
            12
        )

        november = next(
            item for item in response.data['monthly_data']
            if item['month'] == 11
        )

        self.assertEqual(
            Decimal(november['income']),
            Decimal('50000.00')
        )

        self.assertEqual(
            Decimal(november['expenses']),
            Decimal('8000.00')
        )

        self.assertEqual(
            Decimal(november['balance']),
            Decimal('42000.00')
        )

    # -------------------------------------------------
    # 4. CATEGORY ANALYTICS
    # -------------------------------------------------

    def test_category_analytics(self):

        response = self.client.get(
            self.base_url + 'categories/'
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            Decimal(response.data['total_expenses']),
            Decimal('10000.00')
        )

        categories = {
            item['category']: item
            for item in response.data['categories']
        }

        self.assertEqual(
            Decimal(categories['FOOD']['total_expenses']),
            Decimal('7000.00')
        )

        self.assertEqual(
            Decimal(categories['TRAVEL']['total_expenses']),
            Decimal('3000.00')
        )

    # -------------------------------------------------
    # 5. BUDGET ANALYTICS
    # -------------------------------------------------

    def test_budget_analytics(self):

        response = self.client.get(
            self.base_url + 'budgets/'
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            Decimal(response.data['total_allocated']),
            Decimal('10000.00')
        )

        self.assertEqual(
            Decimal(response.data['total_spent']),
            Decimal('5000.00')
        )

        self.assertEqual(
            Decimal(response.data['total_remaining']),
            Decimal('5000.00')
        )

        self.assertEqual(
            response.data['budgets'][0]['utilization_percentage'],
            50.0
        )

    # -------------------------------------------------
    # 6. SAVINGS ANALYTICS
    # -------------------------------------------------

    def test_savings_analytics(self):

        response = self.client.get(
            self.base_url + 'savings/'
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            response.data['total_goals'],
            1
        )

        self.assertEqual(
            Decimal(response.data['total_target']),
            Decimal('50000.00')
        )

        self.assertEqual(
            Decimal(response.data['total_saved']),
            Decimal('20000.00')
        )

        self.assertEqual(
            Decimal(response.data['total_remaining']),
            Decimal('30000.00')
        )

        self.assertEqual(
            response.data['overall_progress'],
            40.0
        )

    # -------------------------------------------------
    # 7. TRENDS ANALYTICS
    # -------------------------------------------------

    def test_trends_analytics(self):

        response = self.client.get(
            self.base_url + 'trends/'
        )

        self.assertEqual(response.status_code, 200)

        trends = {
            item['month']: item
            for item in response.data['trends']
        }

        november = trends['2026-11']

        self.assertEqual(
            Decimal(november['income']),
            Decimal('50000.00')
        )

        self.assertEqual(
            Decimal(november['expenses']),
            Decimal('8000.00')
        )

        self.assertEqual(
            Decimal(november['balance']),
            Decimal('42000.00')
        )

    # -------------------------------------------------
    # 8. FINANCIAL REPORTS
    # -------------------------------------------------

    def test_financial_reports(self):

        response = self.client.get(
            self.base_url + 'reports/'
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            Decimal(response.data['total_income']),
            Decimal('60000.00')
        )

        self.assertEqual(
            Decimal(response.data['total_expenses']),
            Decimal('10000.00')
        )

        self.assertEqual(
            Decimal(response.data['net_balance']),
            Decimal('50000.00')
        )

        self.assertEqual(
            response.data['total_transactions'],
            5
        )

    def test_financial_report_date_filter(self):

        response = self.client.get(
            self.base_url + 'reports/',
            {
                'start_date': '2026-11-01',
                'end_date': '2026-11-30'
            }
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            Decimal(response.data['total_income']),
            Decimal('50000.00')
        )

        self.assertEqual(
            Decimal(response.data['total_expenses']),
            Decimal('8000.00')
        )

        self.assertEqual(
            response.data['total_transactions'],
            3
        )

    def test_invalid_report_start_date(self):

        response = self.client.get(
            self.base_url + 'reports/',
            {'start_date': 'invalid-date'}
        )

        self.assertEqual(response.status_code, 400)

    def test_report_start_date_after_end_date(self):

        response = self.client.get(
            self.base_url + 'reports/',
            {
                'start_date': '2026-11-30',
                'end_date': '2026-11-01'
            }
        )

        self.assertEqual(response.status_code, 400)

    # -------------------------------------------------
    # 9. USER DATA ISOLATION
    # -------------------------------------------------

    def test_dashboard_does_not_include_other_users_data(self):

        response = self.client.get(
            self.base_url + 'dashboard/'
        )

        self.assertEqual(
            Decimal(response.data['total_income']),
            Decimal('60000.00')
        )

        self.assertEqual(
            Decimal(response.data['total_expenses']),
            Decimal('10000.00')
        )

    def test_category_analytics_does_not_include_other_users(self):

        response = self.client.get(
            self.base_url + 'categories/'
        )

        categories = [
            item['category']
            for item in response.data['categories']
        ]

        self.assertNotIn('SHOPPING', categories)

    def test_savings_analytics_does_not_include_other_users(self):

        response = self.client.get(
            self.base_url + 'savings/'
        )

        self.assertEqual(
            response.data['total_goals'],
            1
        )

    def test_budget_analytics_does_not_include_other_users(self):

        response = self.client.get(
            self.base_url + 'budgets/'
        )

        self.assertEqual(
            len(response.data['budgets']),
            1
        )