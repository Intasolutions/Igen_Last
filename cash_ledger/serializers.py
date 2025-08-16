from rest_framework import serializers
from .models import CashLedgerRegister

class CashLedgerRegisterSerializer(serializers.ModelSerializer):
    transaction_type_name = serializers.CharField(source='transaction_type.name', read_only=True)
    cost_centre_name = serializers.CharField(source='cost_centre.name', read_only=True)
    entity_name = serializers.CharField(source='entity.name', read_only=True)
    spent_by_name = serializers.CharField(source='spent_by.full_name', read_only=True)
    document_url = serializers.SerializerMethodField()

    class Meta:
        model = CashLedgerRegister
        fields = '__all__'  # Includes all model fields + computed fields

    def get_document_url(self, obj):
        """
        Returns full absolute URL of uploaded document if available.
        """
        request = self.context.get('request')
        if obj.document and hasattr(obj.document, 'url') and request:
            return request.build_absolute_uri(obj.document.url)
        return None

    def validate(self, data):
        """
        Ensures margin is present if chargeable is True.
        """
        chargeable = data.get('chargeable', False)
        margin = data.get('margin', None)

        if chargeable and (margin is None or margin == 0):
            raise serializers.ValidationError("Margin must be provided and non-zero when chargeable is True.")
        return data
