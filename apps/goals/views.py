from decimal import Decimal
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import SavingsGoal
from .serializers import SavingsGoalSerializer


class SavingsGoalViewSet(viewsets.ModelViewSet):
    serializer_class = SavingsGoalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavingsGoal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        """Custom endpoint: POST /api/goals/<id>/deposit/ {"amount": 500}"""
        goal = self.get_object()
        raw_amount = request.data.get('amount')

        if not raw_amount:
            return Response(
                {"error": "Please provide a deposit amount."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            deposit_value = Decimal(str(raw_amount))
            if deposit_value <= Decimal('0.00'):
                raise ValueError
        except Exception:
            return Response(
                {"error": "Deposit amount must be a positive number."},
                status=status.HTTP_400_BAD_REQUEST
            )

        goal.current_amount += deposit_value
        goal.save()

        serializer = self.get_serializer(goal)
        return Response(serializer.data, status=status.HTTP_200_OK)