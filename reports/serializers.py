# reports/serializers.py
from rest_framework import serializers
from .models import TransactionLedgerCombined


class TransactionLedgerSerializer(serializers.ModelSerializer):
    # Primary key coming from the SQL VIEW ('B:<uuid>' / 'C:<int>')
    id = serializers.CharField(read_only=True)

    # Friendly names for display
    entity_name = serializers.CharField(source='entity.name', read_only=True)
    cost_centre_name = serializers.CharField(source='cost_centre.name', read_only=True)
    transaction_type_name = serializers.CharField(source='transaction_type.name', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    contract_name = serializers.CharField(source='contract.name', read_only=True)

    class Meta:
        model = TransactionLedgerCombined
        # keep fields explicit (stable across refactors & avoids surprises)
        fields = [
            'id',
            'date',
            'amount',
            'source',
            'remarks',

            # FKs (ids)
            'entity',
            'cost_centre',
            'transaction_type',
            'asset',
            'contract',
            'company',

            # Readable names (derived)
            'entity_name',
            'cost_centre_name',
            'transaction_type_name',
            'asset_name',
            'contract_name',
        ]
        read_only_fields = [
            'id',
            'entity_name',
            'cost_centre_name',
            'transaction_type_name',
            'asset_name',
            'contract_name',
        ]
