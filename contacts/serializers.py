from rest_framework import serializers
from .models import Contact

from properties.models import Property


class PropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = Property
        fields = ['id', 'name']

class ContactSerializer(serializers.ModelSerializer):
    # Read-only nested output
  
    linked_properties = PropertySerializer(many=True, read_only=True)

    # Write-only related fields
   
    linked_property_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Property.objects.all(), write_only=True, source='linked_properties'
    )

    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Contact
        fields = [
            'contact_id', 'full_name', 'type', 'stakeholder_types',
            'company', 'phone', 'alternate_phone', 'email',
            'address', 'pan', 'gst', 'notes',
            'landmark', 'pincode', 'city', 'district', 'state', 'country',
             'linked_properties',
             'linked_property_ids',
            'created_at', 'updated_at', 'created_by','is_active',
        ]

    def validate_phone(self, value):
        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")
        return value

    def validate_pan(self, value):
        if value:
            qs = Contact.objects.exclude(pk=self.instance.pk if self.instance else None).filter(pan=value)
            if qs.exists():
                raise serializers.ValidationError("PAN must be unique.")
        return value

def validate(self, data):
    contact_type = data.get('type', getattr(self.instance, 'type', None))
    gst = data.get('gst', getattr(self.instance, 'gst', None))
    stakeholder_types = data.get('stakeholder_types', getattr(self.instance, 'stakeholder_types', None))

    if not stakeholder_types:
        raise serializers.ValidationError({'stakeholder_types': "At least one stakeholder type is required."})
    if contact_type == 'Company' and not gst:
        raise serializers.ValidationError({'gst': "GST number is required for Company type contacts."})

    return data

