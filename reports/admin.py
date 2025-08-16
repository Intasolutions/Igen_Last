from django.contrib import admin
from .models import TransactionLedgerCombined

@admin.register(TransactionLedgerCombined)
class TransactionLedgerCombinedAdmin(admin.ModelAdmin):
    list_display = (
        'date',
        'source',
        'amount',
        'cost_centre',
        'entity',
        'transaction_type',
        'asset',
        'contract',
        'remarks',
        'company'
    )
    list_filter = (
        'source',
        'cost_centre',
        'entity',
        'transaction_type',
        'company',
        'date',
    )
    search_fields = (
        'remarks',
        'transaction_type__name',
        'cost_centre__name',
        'entity__name',
        'contract__name',
        'asset__name',
    )
    ordering = ('-date',)
