from rest_framework import serializers
from .models import Vendor
from companies.models import Company


# Mini serializer for returning only essential company info
class CompanyMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'name']


class VendorSerializer(serializers.ModelSerializer):
    # Accept company_id in requests
    company_id = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(),
        source='company',
        write_only=True
    )
    
    # Return full company object in responses
    company = CompanyMiniSerializer(read_only=True)

    class Meta:
        model = Vendor
        fields = [
            'id',
            'vendor_name',
            'vendor_type',
            'pan_number',
            'gst_number',
            'contact_person',
            'phone_number',
            'email',
            'bank_name',
            'bank_account',
            'ifsc_code',
            'address',
            'notes',
            'created_by',
            'created_on',
            'is_active',
            'company',      # Nested object in GET
            'company_id'    # Accept ID in POST/PUT
        ]

    def validate_pan_number(self, value):
        value = value.strip().upper()
        if len(value) != 10:
            raise serializers.ValidationError("PAN must be 10 characters long")
        return value

    def validate_gst_number(self, value):
        if value:
            value = value.strip().upper()
            if len(value) != 15:
                raise serializers.ValidationError("GST must be 15 characters long")
        return value

    def validate_ifsc_code(self, value):
        value = value.strip().upper()
        if len(value) != 11:
            raise serializers.ValidationError("IFSC must be 11 characters")
        return value

    def validate_phone_number(self, value):
        value = value.strip()
        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")
        return value
