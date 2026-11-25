from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.db.models import Sum

from apps.expenses.models import Expense
from apps.budgets.models import Budget
from apps.goals.models import SavingsGoal
from .models import Notification
from apps.notifications.services import dispatch_notification

@receiver(post_save, sender=Expense)
def check_budget_thresholds(sender, instance, created, **kwargs):
    """Fires whenever an expense is logged or updated."""
    expense_date = instance.date
    user = instance.user
    category = instance.category    

    # Check for a matching monthly budget
    budget = Budget.objects.filter(
        user=user,
        category=category,
        year=expense_date.year,
        month=expense_date.month
    ).first()

    if not budget or budget.monthly_limit <= Decimal('0.00'):
        return

    # Aggregate current category spending
    total_spent = Expense.objects.filter(
        user=user,
        category=category,
        date__year=expense_date.year,
        date__month=expense_date.month
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    utilization = (total_spent / budget.monthly_limit) * Decimal('100.00')

    if utilization >= Decimal('100.00'):
        # Avoid spamming duplicate alerts within the same calendar day
        today = timezone.now().date()
        already_alerted = Notification.objects.filter(
            user=user,
            notification_type='BUDGET_EXCEEDED',
            title__icontains=category,
            created_at__date=today
        ).exists()

        if not already_alerted:
            dispatch_notification(
                user=user,
                notification_type='BUDGET_EXCEEDED',
                title=f"Budget Exceeded: {category}",
                message=f"You have spent ₹{total_spent:,.2f} on {category}, exceeding your monthly limit of ₹{budget.monthly_limit:,.2f} ({utilization:.1f}% used).",
                email_notification=True,
            )
    elif utilization >= Decimal('80.00'):
        today = timezone.now().date()
        already_warned = Notification.objects.filter(
            user=user,
            notification_type='BUDGET_WARNING',
            title__icontains=category,
            created_at__date=today
        ).exists()

        if not already_warned:
            dispatch_notification(
                user=user,
                notification_type='BUDGET_WARNING',
                title=f"Budget Warning: {category}",
                message=f"You have reached {utilization:.1f}% of your monthly limit for {category} (₹{total_spent:,.2f} of ₹{budget.monthly_limit:,.2f}).",
                email_notification=True
            )



@receiver(post_save, sender=SavingsGoal)
def check_savings_milestones(sender, instance, **kwargs):
    """Generate notifications for savings goal milestones."""

    user = instance.user

    # Calculate savings progress
    if instance.target_amount <= 0:
        return

    progress = (
        instance.current_amount / instance.target_amount
    ) * 100

    # Savings Milestones
    milestones = {
        25: "Great start! You've reached 25% of your savings goal.",
        50: "Amazing! You've reached 50% of your savings goal.",
        75: "Almost there! You've reached 75% of your savings goal.",
        100: f"Congratulations! You completed your savings goal: '{instance.title}'."
    }

    for percentage, message in milestones.items():

        if progress >= percentage:

            notification_title = (
                f"{percentage}% Milestone: {instance.title}"
            )

            already_notified = Notification.objects.filter(
                user=user,
                notification_type='GOAL_MILESTONE',
                title=notification_title
            ).exists()

            if not already_notified:

                dispatch_notification(
                    user=user,
                    notification_type='GOAL_MILESTONE',
                    title=notification_title,
                    message=message
                )

    # Deadline Approaching (within 7 days)
    if instance.target_date and progress < 100:

        days_left = (
            instance.target_date - timezone.now().date()
        ).days

        if 0 <= days_left <= 7:

            today = timezone.now().date()

            already_warned = Notification.objects.filter(
                user=user,
                notification_type='GOAL_DEADLINE',
                title=f"Deadline Approaching: {instance.title}",
                created_at__date=today
            ).exists()

            if not already_warned:

                dispatch_notification(
                    user=user,
                    notification_type='GOAL_DEADLINE',
                    title=f"Deadline Approaching: {instance.title}",
                    message=(
                        f"Your goal '{instance.title}' is due in "
                        f"{days_left} day(s). You still need "
                        f"₹{instance.remaining_amount:,.2f}."
                    )
                )