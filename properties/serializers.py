# serializers.py
from rest_framework import serializers
from .models import Property, PropertyDocument, PropertyKeyDate
from companies.models import Company
import json


class PropertyDocumentSerializer(serializers.ModelSerializer):
    # Expose the FK so clients can pass `property` when creating a document
    property = serializers.PrimaryKeyRelatedField(queryset=Property.objects.all())

    class Meta:
        model = PropertyDocument
        fields = ['id', 'property', 'file_name', 'file_url', 'uploaded_on']


class PropertyKeyDateSerializer(serializers.ModelSerializer):
    # Expose the FK so clients can pass `property` when creating a key date
    property = serializers.PrimaryKeyRelatedField(queryset=Property.objects.all())

    class Meta:
        model = PropertyKeyDate
        fields = ['id', 'property', 'date_label', 'due_date', 'remarks']


class PropertySerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all())
    # Read-only nested returns
    document_urls = PropertyDocumentSerializer(many=True, read_only=True, source='documents')
    key_dates = PropertyKeyDateSerializer(many=True, read_only=True)
    company_name = serializers.ReadOnlyField(source='company.name')
    is_active_display = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            'id', 'company', 'company_name', 'name', 'location', 'purpose', 'status', 'is_active',
            'is_active_display', 'config_bhk', 'config_bathroom', 'property_type',
            'build_up_area_sqft', 'land_area_cents', 'expected_rent', 'monthly_rent',
            'lease_start_date', 'lease_end_date', 'next_inspection_date',
            'expected_sale_price', 'igen_service_charge', 'address_line1',
            'address_line2', 'city', 'pincode', 'state', 'country', 'remarks',
            'document_urls', 'key_dates'
        ]

    def get_is_active_display(self, obj):
        return "Active" if obj.is_active else "Inactive"

    def validate(self, data):
        # Required fields
        required_fields = ['company', 'name', 'location', 'purpose', 'status', 'property_type']
        for field in required_fields:
            if not data.get(field):
                raise serializers.ValidationError({field: f"{field.replace('_', ' ').title()} is required"})

        # Validate purpose and status (keep your current mapping)
        valid_statuses = {
            'rental': ['vacant', 'occupied', 'not_for_rent'],
            'sale': ['vacant', 'occupied', 'sold'],
            'care': ['vacant', 'occupied', 'not_for_rent']
        }
        purpose = data.get('purpose')
        status = data.get('status')
        if purpose and status and status not in valid_statuses.get(purpose, []):
            raise serializers.ValidationError({
                "status": f"Invalid status for purpose {purpose}. Valid options: {', '.join(valid_statuses[purpose])}"
            })

        # Validate pincode if provided
        pincode = data.get('pincode')
        if pincode and (not str(pincode).isdigit() or len(str(pincode)) != 6):
            raise serializers.ValidationError({"pincode": "Pincode must be a 6-digit number"})

        # Validate rental-specific fields
        if purpose == 'rental' and data.get('lease_start_date'):
            start = data['lease_start_date']
            if data.get('lease_end_date') and data['lease_end_date'] <= start:
                raise serializers.ValidationError({"lease_end_date": "Lease End Date must be after Lease Start Date"})
            if data.get('next_inspection_date') and data['next_inspection_date'] <= start:
                raise serializers.ValidationError({"next_inspection_date": "Next Inspection Date must be after Lease Start Date"})

        return data

    def create(self, validated_data):
        request = self.context.get('request')
        documents_data = request.FILES.getlist('documents') if request else []
        key_dates_raw = request.data.get('key_dates', '[]')

        try:
            key_dates_data = json.loads(key_dates_raw) if isinstance(key_dates_raw, str) else key_dates_raw
        except json.JSONDecodeError:
            key_dates_data = []

        # Enforce max 20 documents
        if len(documents_data) > 20:
            raise serializers.ValidationError({"documents": "Cannot upload more than 20 documents"})

        # Remove nested keys if present
        validated_data.pop('documents', None)
        validated_data.pop('key_dates', None)

        property_instance = Property.objects.create(**validated_data)

        # Save uploaded documents with custom names if provided
        document_names = request.data.getlist('document_names', []) if request else []
        for i, doc_file in enumerate(documents_data):
            file_name = document_names[i] if i < len(document_names) and document_names[i] else doc_file.name
            PropertyDocument.objects.create(
                property=property_instance,
                file_url=doc_file,
                file_name=file_name
            )

        # Save key date entries
        for kd in key_dates_data:
            if kd.get('date_label') and kd.get('due_date'):
                PropertyKeyDate.objects.create(
                    property=property_instance,
                    date_label=kd.get('date_label', ''),
                    due_date=kd.get('due_date'),
                    remarks=kd.get('remarks', '')
                )

        return property_instance

    def update(self, instance, validated_data):
        request = self.context.get('request')
        documents_data = request.FILES.getlist('documents') if request else []
        key_dates_raw = request.data.get('key_dates', '[]')

        try:
            key_dates_data = json.loads(key_dates_raw) if isinstance(key_dates_raw, str) else key_dates_raw
        except json.JSONDecodeError:
            key_dates_data = []

        # Enforce max 20 documents (existing + new)
        existing_documents = instance.documents.count()
        if existing_documents + len(documents_data) > 20:
            raise serializers.ValidationError({"documents": "Cannot upload more than 20 documents"})

        # Update property instance
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Save new documents with custom names
        document_names = request.data.getlist('document_names', []) if request else []
        for i, doc_file in enumerate(documents_data):
            file_name = document_names[i] if i < len(document_names) and document_names[i] else doc_file.name
            PropertyDocument.objects.create(
                property=instance,
                file_url=doc_file,
                file_name=file_name
            )

        # Replace key dates if provided
        if key_dates_data:
            instance.key_dates.all().delete()
            for kd in key_dates_data:
                if kd.get('date_label') and kd.get('due_date'):
                    PropertyKeyDate.objects.create(
                        property=instance,
                        date_label=kd.get('date_label', ''),
                        due_date=kd.get('due_date'),
                        remarks=kd.get('remarks', '')
                    )

        return instance
