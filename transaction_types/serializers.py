from rest_framework import serializers
from .models import TransactionType

class TransactionTypeSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    cost_centre_name = serializers.CharField(source='cost_centre.name', read_only=True)

    class Meta:
        model = TransactionType
        fields = [
            'transaction_type_id',
            'company',
            'company_name',
            'cost_centre',
            'cost_centre_name',
            'name',
            'direction',
            'gst_applicable',
            'status',
            'remarks',
            'created_at',
            'updated_at',
        ]
