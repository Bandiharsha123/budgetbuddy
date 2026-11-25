from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExpenseViewSet, ExportTransactionsCSVView, ExportTransactionsExcelView ,ExportTransactionsPDFView

router = DefaultRouter()
router.register(r'', ExpenseViewSet, basename='expense')

urlpatterns = [
    path('export-csv/',ExportTransactionsCSVView.as_view(), name='export-transactions-csv'),
    path("export-excel/", ExportTransactionsExcelView.as_view(), name="export-transactions-excel"),
    path('export-pdf/', ExportTransactionsPDFView.as_view(), name='export-transactions-pdf'),
    path('', include(router.urls)),
]