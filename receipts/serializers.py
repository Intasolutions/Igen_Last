# serializers.py
from rest_framework import serializers
from .models import Receipt, TransactionType, CostCentre

# serializers.py
from rest_framework import serializers
from .models import Receipt, TransactionType, CostCentre

class ReceiptSerializer(serializers.ModelSerializer):
    transaction_type_id = serializers.PrimaryKeyRelatedField(
        source='transaction_type', queryset=TransactionType.objects.all(), write_only=True
    )
    transaction_type_name = serializers.CharField(source='transaction_type.name', read_only=True)

    cost_centre_id = serializers.PrimaryKeyRelatedField(
        source='cost_centre', queryset=CostCentre.objects.all(), write_only=True
    )
    cost_centre_name = serializers.CharField(source='cost_centre.name', read_only=True)

    class Meta:
        model = Receipt
        fields = [
            'id', 'transaction_type', 'transaction_type_id', 'transaction_type_name',
            'date', 'amount', 'reference', 'entity', 'company', 'bank',
            'cost_centre', 'cost_centre_id', 'cost_centre_name',
            'notes', 'document'
        ]
        read_only_fields = ['transaction_type', 'cost_centre']
