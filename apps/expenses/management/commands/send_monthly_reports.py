from datetime import datetime
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from dotenv import load_dotenv

from apps.expenses.views import build_financial_report_data
from django.conf import settings

load_dotenv()

class Command(BaseCommand):
    help = "Send previous month's financial reports to all active users."
    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            help='Send the report only to this email address.'
        )
    def handle(self, *args, **options):

        # Get previous month using Indian Standard Time
        today = datetime.now(ZoneInfo("Asia/Kolkata"))

        if today.month == 1:
            report_month = 12
            report_year = today.year - 1
        else:
            report_month = today.month - 1
            report_year = today.year
        User = get_user_model()
        users = User.objects.filter(
            is_active=True
        ).exclude(email="")

        test_email = options.get('email')

        if test_email:
            users = users.filter(email__iexact=test_email)

        self.stdout.write(
            f"Generating reports for {report_month}/{report_year}"
        )

        sent_count = 0
        failed_count = 0

        for user in users:

            try:
                data = build_financial_report_data(
                    user,
                    month=report_month,
                    year=report_year
                )

                category_details = "\n".join(
                    [
                        f"- {item['category']}: "
                        f"Spent INR {item['spent']:,.2f} | "
                        f"Budget INR {item['budget_limit']:,.2f}"
                        for item in data["category_breakdown"]
                    ]
                )

                if not category_details:
                    category_details = "No expenses recorded."

                message = f"""
Hello {user.username},

Here is your BudgetBuddy financial report for {data['period_label']}.

FINANCIAL SUMMARY
-------------------------
Total Income: INR {data['total_income']:,.2f}
Total Expenses: INR {data['total_expense']:,.2f}
Net Balance: INR {data['net_balance']:,.2f}
Savings Rate: {data['savings_rate']}%

CATEGORY-WISE SPENDING
-------------------------
{category_details}

Thank you for using BudgetBuddy!

Regards,
BudgetBuddy Team
"""

                send_mail(
                    subject=f"BudgetBuddy - {data['period_label']}",
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )

                sent_count += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Report sent to {user.email}"
                    )
                )

            except Exception as error:
                failed_count += 1

                self.stdout.write(
                    self.style.ERROR(
                        f"Failed for {user.email}: {error}"
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Completed! Sent: {sent_count}, Failed: {failed_count}"
            )
        )