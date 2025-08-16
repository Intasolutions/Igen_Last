from django.contrib import admin
from .models import TransactionType

@admin.register(TransactionType)
class TransactionTypeAdmin(admin.ModelAdmin):
    list_display = (
        'transaction_type_id',
        'company',
        'cost_centre',
        'name',
        'direction',
        'gst_applicable',
        'status',
        'created_at',
    )
    list_filter = (
        'company',
        'direction',
        'status',
        'gst_applicable',
    )
    search_fields = (
        'name',
        'remarks',
        'company__name',
        'cost_centre__name',
    )
    readonly_fields = (
        'created_at',
        'updated_at',
    )
    ordering = ('-created_at',)
