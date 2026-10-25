from django.db import models
from django.conf import settings
from common.models import Time_Stamped_Model

class Profile(Time_Stamped_Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    monthly_income = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    financial_preferences = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Profile of {self.user.username}"