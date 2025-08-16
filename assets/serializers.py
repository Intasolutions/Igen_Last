from rest_framework import serializers
from .models import Asset, AssetDocument, AssetServiceDue


class AssetServiceDueSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetServiceDue
        fields = ['id', 'due_date', 'description']  # Only needed fields


class AssetDocumentSerializer(serializers.ModelSerializer):
    document = serializers.FileField(use_url=True)

    class Meta:
        model = AssetDocument
        fields = ['id', 'document']  # ✅ Correct field name from the model


class AssetSerializer(serializers.ModelSerializer):
    service_dues = AssetServiceDueSerializer(many=True, read_only=True)
    documents = AssetDocumentSerializer(many=True, read_only=True)

    # Extra fields for frontend readability
    company_name = serializers.CharField(source='company.name', read_only=True)
    property_name = serializers.CharField(source='property.name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = Asset
        fields = [
            'id',
            'company',
            'property',
            'project',
            'name',
            'tag_id',
            'category',
            'purchase_date',
            'purchase_price',
            'warranty_expiry',
            'location',
            'maintenance_frequency',
            'notes',
            'is_active',
            'created_at',
            'documents',
            'service_dues',
            'company_name',
            'property_name',
            'project_name',
        ]
