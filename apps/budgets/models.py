from django.db import models
from django.conf import settings
from common.models import Time_Stamped_Model
from apps.expenses.models import Expense

class Budget(Time_Stamped_Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budgets')
    category = models.CharField(max_length=30, choices=Expense.CATEGORY_CHOICES)
    monthly_limit = models.DecimalField(max_digits=10, decimal_places=2)
    month = models.PositiveSmallIntegerField()
    year = models.PositiveIntegerField()

    class Meta:
        unique_together = ('user', 'category', 'month', 'year')

    def __str__(self):
        return f"{self.user.username} Budget ({self.category} {self.month}/{self.year}): {self.monthly_limit}"