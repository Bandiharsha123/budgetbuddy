from django.contrib.auth.models import AbstractUser
from django.db import models
from common.models import Time_Stamped_Model

class User(AbstractUser, Time_Stamped_Model):
    ROLE_CHOICES = (
        ('STUDENT', 'Student'),
        ('PREMIUM', 'Premium User'),
        ('ADMIN', 'Admin'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STUDENT')

    def __str__(self):
        return f"{self.username} ({self.role})"