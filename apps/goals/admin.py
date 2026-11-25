from django.contrib import admin
from .models import SavingsGoal


@admin.register(SavingsGoal)
class SavingsGoalAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'current_amount', 'target_amount', 'target_date', 'is_completed')
    list_filter = ('target_date', 'user')
    search_fields = ('title', 'user__username')