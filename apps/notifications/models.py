from django.db import models
from django.conf import settings
from common.models import Time_Stamped_Model


class Notification(Time_Stamped_Model):
    NOTIFICATION_TYPES = (
        ('BUDGET_WARNING', 'Budget Warning (>80%)'),
        ('BUDGET_EXCEEDED', 'Budget Exceeded (>100%)'),
        ('GOAL_MILESTONE', 'Goal Milestone'),
        ('GOAL_DEADLINE', 'Goal Deadline Approaching'),
        ('GENERAL', 'General Info'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    notification_type = models.CharField(
        max_length=25,
        choices=NOTIFICATION_TYPES,
        default='GENERAL'
    )
    title = models.CharField(max_length=150)
    message = models.TextField()
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] {self.user.username} - {self.title}"