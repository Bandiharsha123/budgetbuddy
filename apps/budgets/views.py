

# Create your views here.
from rest_framework import viewsets, permissions
from .models import Budget
from .serializers import BudgetSerializer


class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Budget.objects.filter(user=self.request.user)
        
        # Optional query parameter filtering: ?month=10&year=2026
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')

        if month:
            queryset = queryset.filter(month=month)
        if year:
            queryset = queryset.filter(year=year)

        return queryset.order_by('-year', '-month', 'category')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)