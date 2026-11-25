from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import AbstractUser
from django.db import models



class User(AbstractUser):
    ROLE_CHOICES = (
        ('STUDENT', 'Student'),
        ('PREMIUM', 'Premium User'),
        ('ADMIN', 'Admin'),
    )

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=15,
        choices=ROLE_CHOICES,
        default='STUDENT',
    )

    def __str__(self):
        return f"{self.username} ({self.role})"

