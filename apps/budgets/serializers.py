from decimal import Decimal
from django.db.models import Sum
from rest_framework import serializers

from .models import Budget
from apps.expenses.models import Expense


class BudgetSerializer(serializers.ModelSerializer):
    spent_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    utilization_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = [
            'id',
            'category',
            'monthly_limit',
            'month',
            'year',
            'spent_amount',
            'remaining_amount',
            'utilization_percentage',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def validate_monthly_limit(self, value):
        if value <= Decimal('0.00'):
            raise serializers.ValidationError("Monthly limit must be greater than zero.")
        return value

    def validate_month(self, value):
        if not (1 <= value <= 12):
            raise serializers.ValidationError("Month must be between 1 and 12.")
        return value

    def _get_expenses_total(self, obj):
        total = Expense.objects.filter(
            user=obj.user,
            category=obj.category,
            date__year=obj.year,
            date__month=obj.month,
        ).aggregate(total=Sum('amount'))['total']
        
        return total or Decimal('0.00')

    def get_spent_amount(self, obj):
        return self._get_expenses_total(obj)

    def get_remaining_amount(self, obj):
        spent = self._get_expenses_total(obj)
        return obj.monthly_limit - spent

    def get_utilization_percentage(self, obj):
        spent = self._get_expenses_total(obj)
        if obj.monthly_limit > Decimal('0.00'):
            percentage = (spent / obj.monthly_limit) * 100
            return round(float(percentage), 2)
        return 0.0