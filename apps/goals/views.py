from decimal import Decimal

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.notifications.services import dispatch_notification

from .models import SavingsGoal
from .serializers import SavingsGoalSerializer


class SavingsGoalViewSet(viewsets.ModelViewSet):
    serializer_class = SavingsGoalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavingsGoal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def send_goal_milestones(self, goal, previous_progress):
        current_progress = Decimal(str(goal.progress_percentage))

        milestones = [
            (Decimal("50"), "Halfway There!"),
            (Decimal("75"), "Almost There!"),
            (Decimal("100"), "Goal Achieved!"),
        ]

        for milestone, title in milestones:
            if previous_progress < milestone <= current_progress:

                message = (
                    f"Your savings goal '{goal.title}' has reached "
                    f"{milestone}% completion. "
                    f"You have saved INR {goal.current_amount} "
                    f"out of INR {goal.target_amount}."
                )

                dispatch_notification(
                    user=goal.user,
                    notification_type="GOAL_MILESTONE",
                    title=title,
                    message=message,
                    event_key=f"goal_{goal.id}_milestone_{int(milestone)}",
                    send_email=True,
                    send_push=True,
                )

    def perform_update(self, serializer):
        goal = self.get_object()
        previous_progress = Decimal(str(goal.progress_percentage))

        updated_goal = serializer.save()

        self.send_goal_milestones(updated_goal, previous_progress)

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
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

        previous_progress = Decimal(str(goal.progress_percentage))

        goal.current_amount += deposit_value
        goal.save()

        self.send_goal_milestones(goal, previous_progress)

        serializer = self.get_serializer(goal)
        return Response(serializer.data, status=status.HTTP_200_OK)