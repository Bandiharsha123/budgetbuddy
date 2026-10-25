from django.db import models
from django.conf import settings
from common.models import Time_Stamped_Model

class SavingsGoal(Time_Stamped_Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='savings_goals')
    title = models.CharField(max_length=150)
    target_amount = models.DecimalField(max_digits=10, decimal_places=2)
    current_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    target_date = models.DateField()

    def __str__(self):
        return f"{self.title} - {self.current_amount}/{self.target_amount}"