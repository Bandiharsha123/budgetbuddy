from django.db import models
from django.conf import settings
from common.models import Time_Stamped_Model

class Notification(Time_Stamped_Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Notification for {self.user.username} (Read: {self.is_read})"