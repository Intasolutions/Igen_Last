# bank_uploads/serializers.py
from rest_framework import serializers
from .models import BankTransaction, BankUploadBatch
from banks.serializers import BankAccountSerializer  # optional nested read


class BankTransactionSerializer(serializers.ModelSerializer):
    bank_account = BankAccountSerializer(read_only=True)
    bank_account_id = serializers.PrimaryKeyRelatedField(
        queryset=BankTransaction._meta.get_field('bank_account').related_model.objects.all(),
        write_only=True,
        source='bank_account'
    )
    upload_batch = serializers.PrimaryKeyRelatedField(read_only=True)

    amount = serializers.SerializerMethodField()
    transaction_type = serializers.SerializerMethodField()

    class Meta:
        model = BankTransaction
        exclude = ['is_deleted', 'deleted_at', 'dedupe_key']
        read_only_fields = [
            'id', 'created_at', 'bank_account', 'amount', 'transaction_type',
            'signed_amount', 'upload_batch', 'source'
        ]

    def get_amount(self, obj):
        # signed_amount already +/- normalized
        return str(obj.signed_amount)

    def get_transaction_type(self, obj):
        return 'CREDIT' if obj.signed_amount >= 0 else 'DEBIT'


class BatchTransactionsResponseSerializer(serializers.Serializer):
    transactions = BankTransactionSerializer(many=True)
    total_credit = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_debit = serializers.DecimalField(max_digits=12, decimal_places=2)
    final_balance = serializers.DecimalField(max_digits=12, decimal_places=2)


class UploadRowErrorSerializer(serializers.Serializer):
    row = serializers.IntegerField()
    error = serializers.CharField()
    row_data = serializers.ListField(child=serializers.CharField(), required=False)


class BankUploadBatchSerializer(serializers.ModelSerializer):
    bank_account = BankAccountSerializer(read_only=True)

    class Meta:
        model = BankUploadBatch
        fields = [
            'id', 'bank_account', 'file_name', 'uploaded_by',
            'uploaded_count', 'skipped_count', 'errors_count',
            'balance_continuity_in_file', 'previous_ending_balance_match',
            'created_at'
        ]
        read_only_fields = fields
