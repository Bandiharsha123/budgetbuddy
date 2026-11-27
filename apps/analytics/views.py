from django.shortcuts import render

# Create your views here.
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.incomes.models import Income
from apps.expenses.models import Expense
from django.db.models.functions import TruncMonth
from django.utils.dateparse import parse_date

from apps.budgets.models import Budget
from apps.goals.models import SavingsGoal


class DashboardAnalyticsView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        today = timezone.localdate()
        current_month = today.month
        current_year = today.year

        # Overall income
        total_income = (
            Income.objects.filter(user=user)
            .aggregate(total=Sum('amount'))['total']
            or Decimal('0.00')
        )

        # Overall expenses
        total_expenses = (
            Expense.objects.filter(user=user)
            .aggregate(total=Sum('amount'))['total']
            or Decimal('0.00')
        )

        # Overall balance
        balance = total_income - total_expenses

        # Current month income
        monthly_income = (
            Income.objects.filter(
                user=user,
                date__month=current_month,
                date__year=current_year
            )
            .aggregate(total=Sum('amount'))['total']
            or Decimal('0.00')
        )

        # Current month expenses
        monthly_expenses = (
            Expense.objects.filter(
                user=user,
                date__month=current_month,
                date__year=current_year
            )
            .aggregate(total=Sum('amount'))['total']
            or Decimal('0.00')
        )

        # Current month balance
        monthly_balance = monthly_income - monthly_expenses

        # Savings rate
        savings_rate = (
            (monthly_balance / monthly_income) * 100
            if monthly_income > 0
            else Decimal('0.00')
        )

        return Response({
            "total_income": total_income,
            "total_expenses": total_expenses,
            "balance": balance,

            "monthly_income": monthly_income,
            "monthly_expenses": monthly_expenses,
            "monthly_balance": monthly_balance,

            "savings_rate": round(float(savings_rate), 2),

            "month": current_month,
            "year": current_year
        })

class MonthlyAnalyticsView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user
        today = timezone.localdate()

        monthly_data = []

        for month in range(1, 13):

            income = (
                Income.objects.filter(
                    user=user,
                    date__year=today.year,
                    date__month=month
                ).aggregate(total=Sum('amount'))['total']
                or Decimal('0.00')
            )

            expenses = (
                Expense.objects.filter(
                    user=user,
                    date__year=today.year,
                    date__month=month
                ).aggregate(total=Sum('amount'))['total']
                or Decimal('0.00')
            )

            monthly_data.append({
                "month": month,
                "income": income,
                "expenses": expenses,
                "balance": income - expenses
            })

        return Response({
            "year": today.year,
            "monthly_data": monthly_data
        })

class CategoryAnalyticsView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        category_data = (
            Expense.objects.filter(user=user)
            .values('category')
            .annotate(total=Sum('amount'))
            .order_by('-total')
        )

        total_expenses = (
            Expense.objects.filter(user=user)
            .aggregate(total=Sum('amount'))['total']
            or Decimal('0.00')
        )

        results = []

        for item in category_data:

            amount = item['total']

            percentage = (
                (amount / total_expenses) * 100
                if total_expenses > 0
                else Decimal('0.00')
            )

            results.append({
                "category": item['category'],
                "total_expenses": amount,
                "percentage": round(float(percentage), 2)
            })

        return Response({
            "total_expenses": total_expenses,
            "categories": results
        })



# =====================================================
# 4. BUDGET ANALYTICS
# =====================================================

class BudgetAnalyticsView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        budgets = Budget.objects.filter(user=user).order_by(
            '-year', '-month', 'category'
        )

        results = []

        total_allocated = Decimal('0.00')
        total_spent = Decimal('0.00')

        for budget in budgets:

            spent = (
                Expense.objects.filter(
                    user=user,
                    category=budget.category,
                    date__month=budget.month,
                    date__year=budget.year
                ).aggregate(total=Sum('amount'))['total']
                or Decimal('0.00')
            )

            remaining = budget.monthly_limit - spent

            utilization = (
                (spent / budget.monthly_limit) * 100
                if budget.monthly_limit > 0
                else Decimal('0.00')
            )

            total_allocated += budget.monthly_limit
            total_spent += spent

            results.append({
                "category": budget.category,
                "month": budget.month,
                "year": budget.year,
                "budget_limit": budget.monthly_limit,
                "spent_amount": spent,
                "remaining_amount": remaining,
                "utilization_percentage": round(
                    float(utilization), 2
                ),
                "is_overspent": spent > budget.monthly_limit
            })

        return Response({
            "total_allocated": total_allocated,
            "total_spent": total_spent,
            "total_remaining": total_allocated - total_spent,
            "budgets": results
        })


# =====================================================
# 5. SAVINGS GOALS ANALYTICS
# =====================================================

class SavingsAnalyticsView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        goals = SavingsGoal.objects.filter(user=user)

        total_target = Decimal('0.00')
        total_saved = Decimal('0.00')

        results = []

        for goal in goals:

            total_target += goal.target_amount
            total_saved += goal.current_amount

            results.append({
                "id": goal.id,
                "title": goal.title,
                "target_amount": goal.target_amount,
                "current_amount": goal.current_amount,
                "remaining_amount": goal.remaining_amount,
                "progress_percentage": goal.progress_percentage,
                "target_date": goal.target_date,
                "is_completed": goal.is_completed
            })

        total_remaining = max(
            Decimal('0.00'),
            total_target - total_saved
        )

        overall_progress = (
            (total_saved / total_target) * 100
            if total_target > 0
            else Decimal('0.00')
        )

        return Response({
            "total_goals": goals.count(),
            "total_target": total_target,
            "total_saved": total_saved,
            "total_remaining": total_remaining,
            "overall_progress": round(
                float(overall_progress), 2
            ),
            "goals": results
        })


# =====================================================
# 6. INCOME VS EXPENSE TRENDS
# =====================================================

class TrendsAnalyticsView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        monthly_income = (
            Income.objects.filter(user=user)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('amount'))
        )

        monthly_expenses = (
            Expense.objects.filter(user=user)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('amount'))
        )

        income_data = {
            item['month'].strftime('%Y-%m'): item['total']
            for item in monthly_income
        }

        expense_data = {
            item['month'].strftime('%Y-%m'): item['total']
            for item in monthly_expenses
        }

        all_months = sorted(
            set(income_data.keys()) | set(expense_data.keys())
        )

        results = []

        for month in all_months:

            income = income_data.get(
                month, Decimal('0.00')
            )

            expenses = expense_data.get(
                month, Decimal('0.00')
            )

            results.append({
                "month": month,
                "income": income,
                "expenses": expenses,
                "balance": income - expenses
            })

        return Response({
            "trends": results
        })


# =====================================================
# 7. FINANCIAL REPORTS
# =====================================================

class FinancialReportsView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        expenses = Expense.objects.filter(user=user)
        incomes = Income.objects.filter(user=user)

        if start_date:

            parsed_start = parse_date(start_date)

            if not parsed_start:
                return Response(
                    {"error": "Invalid start_date. Use YYYY-MM-DD."},
                    status=400
                )

            expenses = expenses.filter(date__gte=parsed_start)
            incomes = incomes.filter(date__gte=parsed_start)

        if end_date:

            parsed_end = parse_date(end_date)

            if not parsed_end:
                return Response(
                    {"error": "Invalid end_date. Use YYYY-MM-DD."},
                    status=400
                )

            expenses = expenses.filter(date__lte=parsed_end)
            incomes = incomes.filter(date__lte=parsed_end)

        if start_date and end_date and parsed_start > parsed_end:
            return Response(
                {"error": "start_date cannot be after end_date."},
                status=400
            )

        total_income = (
            incomes.aggregate(total=Sum('amount'))['total']
            or Decimal('0.00')
        )

        total_expenses = (
            expenses.aggregate(total=Sum('amount'))['total']
            or Decimal('0.00')
        )

        category_summary = (
            expenses.values('category')
            .annotate(total=Sum('amount'))
            .order_by('-total')
        )

        return Response({
            "start_date": start_date,
            "end_date": end_date,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_balance": total_income - total_expenses,
            "total_transactions": (
                incomes.count() + expenses.count()
            ),
            "category_summary": list(category_summary)
        })