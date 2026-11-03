from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Budget


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ('user', 'category', 'monthly_limit', 'month', 'year', 'created_at')
    list_filter = ('category', 'month', 'year')
    search_fields = ('user__username', 'category')