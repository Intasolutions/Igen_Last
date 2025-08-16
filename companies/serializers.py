from rest_framework import serializers
from .models import Company, CompanyDocument

from rest_framework import serializers
from .models import Company, CompanyDocument

# Serializer for documents uploaded for a company
class CompanyDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyDocument
        fields = [
            'id',
            'file',
            'uploaded_at'
        ]

# Serializer for company details with nested documents read-only
class CompanySerializer(serializers.ModelSerializer):
    documents = CompanyDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = Company
        fields = [
            'id',
            'name',
            'pan',
            'gst',
            'mca',
            'address',
            'notes',
            'documents',
            'created_at',
            'is_active' 
        ]
