from django.db import models
from django.conf import settings
from common.models import Time_Stamped_Model

class Income(Time_Stamped_Model):
    SOURCE_CHOICES = (
        ('POCKET_MONEY', 'Pocket Money'),
        ('SCHOLARSHIP', 'Scholarship'),
        ('FREELANCE', 'Freelance Income'),
        ('OTHER', 'Other'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='incomes')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    source = models.CharField(max_length=30, choices=SOURCE_CHOICES, default='POCKET_MONEY')
    date = models.DateField()
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} - {self.source}: {self.amount}"