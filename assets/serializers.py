from rest_framework import serializers
from .models import Asset, AssetDocument, AssetServiceDue


class AssetServiceDueSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetServiceDue
        fields = ['id', 'due_date', 'description', 'completed']  # include completed


class AssetDocumentSerializer(serializers.ModelSerializer):
    document = serializers.FileField(use_url=True)

    class Meta:
        model = AssetDocument
        fields = ['id', 'document', 'uploaded_at']


class AssetSerializer(serializers.ModelSerializer):
    service_dues = AssetServiceDueSerializer(many=True, read_only=True)
    documents = AssetDocumentSerializer(many=True, read_only=True)

    # Extra fields for frontend readability
    company_name = serializers.CharField(source='company.name', read_only=True)
    property_name = serializers.CharField(source='property.name', read_only=True, default=None)
    project_name = serializers.CharField(source='project.name', read_only=True, default=None)
    entity_name = serializers.CharField(source='entity.name', read_only=True, default=None)

    class Meta:
        model = Asset
        fields = [
            'id',
            'company',
            'property',
            'project',
            'entity',           # NEW
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
            'entity_name',
        ]
        read_only_fields = ['created_at', 'documents', 'service_dues',
                            'company_name', 'property_name', 'project_name', 'entity_name']

    def validate(self, data):
        """
        Exactly ONE of property/project/entity must be set.
        Also (optional) ensure linked object belongs to same company if your models have that.
        """
        prop = data.get('property', getattr(self.instance, 'property', None))
        proj = data.get('project', getattr(self.instance, 'project', None))
        ent = data.get('entity', getattr(self.instance, 'entity', None))

        links_set = sum(1 for v in (prop, proj, ent) if v)
        if links_set != 1:
            raise serializers.ValidationError("Exactly one of property, project, or entity must be provided.")

        comp = data.get('company', getattr(self.instance, 'company', None))
        # Company consistency checks (comment out if not applicable in your domain)
        if comp:
            if prop and getattr(prop, 'company_id', None) != comp.id:
                raise serializers.ValidationError({"property": "Property belongs to a different company."})
            if proj and getattr(proj, 'company_id', None) != comp.id:
                raise serializers.ValidationError({"project": "Project belongs to a different company."})
            if ent and getattr(ent, 'company_id', None) not in (None, comp.id):
                # allow entity without company (if allowed); else enforce equality strictly
                raise serializers.ValidationError({"entity": "Entity belongs to a different company."})

        # Optional: enforce warranty after purchase_date
        purchase_date = data.get('purchase_date', getattr(self.instance, 'purchase_date', None))
        warranty_expiry = data.get('warranty_expiry', getattr(self.instance, 'warranty_expiry', None))
        if purchase_date and warranty_expiry and purchase_date > warranty_expiry:
            raise serializers.ValidationError({"warranty_expiry": "Warranty must be after purchase date."})

        return data



