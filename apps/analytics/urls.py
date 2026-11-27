from django.urls import path

from .views import (
    DashboardAnalyticsView,
    MonthlyAnalyticsView,
    CategoryAnalyticsView,
    BudgetAnalyticsView,
    SavingsAnalyticsView,
    TrendsAnalyticsView,
    FinancialReportsView,
)

urlpatterns = [
    path(
        'dashboard/',
        DashboardAnalyticsView.as_view(),
        name='dashboard-analytics'
    ),
    path(
        'monthly/',
        MonthlyAnalyticsView.as_view(),
        name='monthly-analytics'
    ),
    path(
        'categories/',
        CategoryAnalyticsView.as_view(),
        name='category-analytics'
    ),
    path(
        'budgets/',
        BudgetAnalyticsView.as_view(),
        name='budget-analytics'
    ),
    path(
        'savings/',
        SavingsAnalyticsView.as_view(),
        name='savings-analytics'
    ),
    path(
        'trends/',
        TrendsAnalyticsView.as_view(),
        name='trends-analytics'
    ),
    path('reports/',FinancialReportsView.as_view(),name='financial-reports'),
]