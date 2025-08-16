from django.contrib import admin
from .models import CashLedgerRegister

@admin.register(CashLedgerRegister)
class CashLedgerRegisterAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'date', 'company', 'spent_by', 'cost_centre', 'entity',
        'transaction_type', 'amount', 'chargeable', 'margin',
        'balance_amount', 'is_active', 'created_on'
    )
    list_filter = ('is_active', 'company', 'cost_centre', 'entity', 'transaction_type', 'chargeable')
    search_fields = ('remarks', 'spent_by__full_name', 'entity__name', 'cost_centre__name')
    readonly_fields = ('created_on', 'balance_amount')
    list_per_page = 25

    def has_delete_permission(self, request, obj=None):
        """
        Disable hard delete from admin to preserve soft delete policy.
        """
        return False
