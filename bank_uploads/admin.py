# bank_uploads/admin.py
from django.contrib import admin
from .models import BankTransaction, BankUploadBatch


@admin.register(BankTransaction)
class BankTransactionAdmin(admin.ModelAdmin):
    list_display = (
        'transaction_date', 'narration',
        'credit_amount', 'debit_amount', 'signed_amount',
        'balance_amount', 'utr_number',
        'bank_account', 'upload_batch',
        'is_deleted', 'created_at',
    )
    list_filter = ('bank_account', 'transaction_date', 'is_deleted', 'upload_batch')
    search_fields = ('narration', 'utr_number')
    readonly_fields = ('created_at', 'dedupe_key', 'signed_amount')


@admin.register(BankUploadBatch)
class BankUploadBatchAdmin(admin.ModelAdmin):
    list_display = (
        'created_at', 'file_name', 'bank_account', 'uploaded_by',
        'uploaded_count', 'skipped_count', 'errors_count',
        'balance_continuity_in_file', 'previous_ending_balance_match',
    )
    list_filter = ('bank_account', 'created_at', 'uploaded_by')
    search_fields = ('file_name',)
