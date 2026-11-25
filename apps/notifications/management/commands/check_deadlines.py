from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db.models import F
from django.utils import timezone
from apps.notifications.services import dispatch_notification
from apps.goals.models import SavingsGoal
from apps.notifications.models import Notification


class Command(BaseCommand):
    help = "Scans active savings goals and dispatches deadline notifications for targets due within 7 days."

    def handle(self, *args, **options):
        today = timezone.now().date()
        threshold_date = today + timedelta(days=7)

        # Retrieve goals that are not yet funded and have a deadline in the next 7 days
        approaching_goals = SavingsGoal.objects.filter(
            current_amount__lt=F('target_amount'),
            target_date__gte=today,
            target_date__lte=threshold_date,
        )

        created_count = 0

        for goal in approaching_goals:
            days_left = (goal.target_date - today).days

            # Guard against duplicate alerts for the same goal on the same day
            already_notified = Notification.objects.filter(
                user=goal.user,
                notification_type='GOAL_DEADLINE',
                title__icontains=goal.title,
                created_at__date=today,
            ).exists()

            if not already_notified:
                deadline_str = "today" if days_left == 0 else f"in {days_left} day(s)"
                dispatch_notification(
                    user=goal.user,
                    notification_type='GOAL_DEADLINE',
                    title=f"Goal Deadline Approaching: {goal.title}",
                    message=(
                        f"Your goal '{goal.title}' is due {deadline_str} ({goal.target_date}). "
                        f"Remaining amount needed: ₹{goal.remaining_amount:,.2f}."
                    ),
                    email_notification=True
                )
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully checked deadlines. Created {created_count} new notification(s)."
            )
        )