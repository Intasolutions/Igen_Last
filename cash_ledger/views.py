from rest_framework import viewsets, permissions, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.http import HttpResponse
import csv

from .models import CashLedgerRegister
from .serializers import CashLedgerRegisterSerializer

class CashLedgerRegisterViewSet(viewsets.ModelViewSet):
    serializer_class = CashLedgerRegisterSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['company', 'cost_centre', 'entity', 'transaction_type', 'spent_by', 'chargeable', 'is_active']
    search_fields = ['remarks']
    ordering_fields = ['date', 'amount']

    def get_queryset(self):
        user = self.request.user

        if user.role == 'SUPER_USER':
            return CashLedgerRegister.objects.filter(is_active=True).order_by('-date', '-id')

        company = user.companies.first()
        if not company:
            return CashLedgerRegister.objects.none()

        return CashLedgerRegister.objects.filter(company=company, is_active=True).order_by('-date', '-id')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        user = self.request.user

        if user.role == 'SUPER_USER':
            company = serializer.validated_data.get('company')
            if not company:
                raise serializers.ValidationError("Super User must specify company explicitly.")
        else:
            company = user.companies.first()
            if not company:
                raise serializers.ValidationError("User is not linked to any company.")

        last_entry = CashLedgerRegister.objects.filter(company=company, is_active=True).order_by('-date', '-id').first()
        previous_balance = last_entry.balance_amount if last_entry else 0

        amount = serializer.validated_data['amount']
        chargeable = serializer.validated_data.get('chargeable', False)
        margin = serializer.validated_data.get('margin') or 0

        effective_amount = amount - margin if chargeable and margin else amount
        new_balance = previous_balance - effective_amount

        serializer.save(
            created_by=user,
            company=company,
            balance_amount=new_balance,
            is_active=True
        )

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete (deactivate) a cash ledger entry.
        """
        entry = self.get_object()
        entry.is_active = False
        entry.save()
        return Response({"detail": "Entry deactivated successfully."}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='balance')
    def get_current_balance(self, request):
        user = request.user

        if user.role == 'SUPER_USER':
            last_entry = CashLedgerRegister.objects.filter(is_active=True).order_by('-date', '-id').first()
        else:
            company = user.companies.first()
            if not company:
                return Response({"current_balance": 0})
            last_entry = CashLedgerRegister.objects.filter(company=company, is_active=True).order_by('-date', '-id').first()

        balance = last_entry.balance_amount if last_entry else 0
        return Response({"current_balance": balance})

    @action(detail=False, methods=['get'], url_path='export')
    def export_to_csv(self, request):
        queryset = self.filter_queryset(self.get_queryset())

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="cash_ledger_export.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Date', 'Spent By', 'Cost Centre', 'Entity', 'Transaction Type',
            'Amount', 'Chargeable', 'Margin', 'Balance', 'Remarks'
        ])

        for obj in queryset:
            writer.writerow([
                obj.date,
                obj.spent_by.full_name if obj.spent_by else '',
                obj.cost_centre.name if obj.cost_centre else '',
                obj.entity.name if obj.entity else '',
                obj.transaction_type.name if obj.transaction_type else '',
                obj.amount,
                'Yes' if obj.chargeable else 'No',
                obj.margin or '',
                obj.balance_amount,
                obj.remarks or ''
            ])

        return response
