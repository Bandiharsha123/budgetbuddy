import calendar
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import Sum
from django.utils import timezone

from apps.expenses.models import Expense
from apps.incomes.models import Income
from apps.notifications.models import Notification
from apps.notifications.services import dispatch_notification
from apps.profiles.models import Profile

User = get_user_model()


class Command(BaseCommand):
    help = "Generates in-app and SendGrid email monthly financial summaries."

    def handle(self, *args, **options):
        today = timezone.now().date()
        month = today.month
        year = today.year
        month_name = calendar.month_name[month]

        created_count = 0
        for user in User.objects.all():
            profile, _ = Profile.objects.get_or_create(user=user)
            prefs = profile.financial_preferences or {}

            if not prefs.get('monthly_report_notifications', True):
                continue

            title = f"Monthly Financial Report Ready: {month_name} {year}"
            if Notification.objects.filter(
                user=user,
                notification_type='MONTHLY_REPORT',
                title=title
            ).exists():
                continue

            total_inc = Income.objects.filter(
                user=user, date__month=month, date__year=year
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            total_exp = Expense.objects.filter(
                user=user, date__month=month, date__year=year
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            net = total_inc - total_exp
            summary_msg = (
                f"{month_name} {year} Summary — Income: ₹{total_inc:,.2f} | "
                f"Expenses: ₹{total_exp:,.2f} | Net Savings: ₹{net:,.2f}. "
                f"Download your full PDF/Excel statement in Overview & Activity."
            )

            dispatch_notification(
                user=user,
                notification_type='MONTHLY_REPORT',
                title=title,
                message=summary_msg,
                send_email=True,
            )
            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(f"Dispatched {created_count} monthly report alert(s) via In-App & SendGrid.")
        )