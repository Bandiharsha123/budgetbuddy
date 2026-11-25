from decimal import Decimal
from django.db import models
from django.conf import settings
from common.models import Time_Stamped_Model


class SavingsGoal(Time_Stamped_Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='savings_goals'
    )
    title = models.CharField(max_length=150)
    target_amount = models.DecimalField(max_digits=10, decimal_places=2)
    current_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    target_date = models.DateField()

    class Meta:
        ordering = ['target_date', 'title']

    def __str__(self):
        return f"{self.title} ({self.current_amount}/{self.target_amount})"

    @property
    def remaining_amount(self):
        remainder = self.target_amount - self.current_amount
        return max(Decimal('0.00'), remainder)

    @property
    def progress_percentage(self):
        if self.target_amount > Decimal('0.00'):
            percentage = (self.current_amount / self.target_amount) * Decimal('100.00')
            return round(float(percentage), 2)
        return 0.0

    @property
    def is_completed(self):
        return self.current_amount >= self.target_amount