from decimal import Decimal
from rest_framework import serializers
from .models import SavingsGoal


class SavingsGoalSerializer(serializers.ModelSerializer):
    remaining_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    progress_percentage = serializers.FloatField(read_only=True)
    is_completed = serializers.BooleanField(read_only=True)

    class Meta:
        model = SavingsGoal
        fields = [
            'id',
            'title',
            'target_amount',
            'current_amount',
            'remaining_amount',
            'progress_percentage',
            'target_date',
            'is_completed',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def validate_target_amount(self, value):
        if value <= Decimal('0.00'):
            raise serializers.ValidationError("Target amount must be greater than zero.")
        return value

    def validate_current_amount(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Current saved amount cannot be negative.")
        return value