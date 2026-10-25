from django.db import models
from django.conf import settings
from common.models import Time_Stamped_Model

class Expense(Time_Stamped_Model):
    CATEGORY_CHOICES = (
        ('FOOD', 'Food'),
        ('TRAVEL', 'Travel'),
        ('SHOPPING', 'Shopping'),
        ('EDUCATION', 'Education'),
        ('ENTERTAINMENT', 'Entertainment'),
        ('MISCELLANEOUS', 'Miscellaneous'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='expenses')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='MISCELLANEOUS')
    date = models.DateField()
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} - {self.category}: {self.amount}"