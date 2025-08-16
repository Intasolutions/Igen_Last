from rest_framework import serializers
from .models import Entity


class EntitySerializer(serializers.ModelSerializer):
    # Read-only display helpers
    company_name = serializers.CharField(source='company.name', read_only=True)

    linked_property_name = serializers.CharField(
        source='linked_property.name', read_only=True, default=None
    )
    linked_project_name = serializers.CharField(
        source='linked_project.name', read_only=True, default=None
    )
    linked_contact_name = serializers.CharField(
        source='linked_contact.full_name', read_only=True, default=None
    )

    class Meta:
        model = Entity
        fields = [
            'id',
            'company', 'company_name',
            'name', 'entity_type',
            'linked_property', 'linked_property_name',
            'linked_project', 'linked_project_name',
            'linked_contact', 'linked_contact_name',
            'status', 'remarks',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company_name',
            'linked_property_name',
            'linked_project_name',
            'linked_contact_name',
            'created_at', 'updated_at',
        ]

    def validate(self, data):
        """
        Enforce the correct linkage based on entity_type.
        Works for both create and update (partial/put).
        - Property  -> requires linked_property; clears project/contact
        - Project   -> requires linked_project;  clears property/contact
        - Contact   -> requires linked_contact;  clears property/project
        - Internal  -> clears all links
        """
        # When updating, fall back to current instance values if a field isn't provided
        e_type = data.get('entity_type', getattr(self.instance, 'entity_type', None))

        lp = data.get('linked_property', getattr(self.instance, 'linked_property', None))
        lj = data.get('linked_project', getattr(self.instance, 'linked_project', None))
        lc = data.get('linked_contact', getattr(self.instance, 'linked_contact', None))

        if e_type == 'Property':
            if not lp:
                raise serializers.ValidationError({
                    "linked_property": "linked_property is required for entity_type='Property'."
                })
            # clear others
            data['linked_project'] = None
            data['linked_contact'] = None

        elif e_type == 'Project':
            if not lj:
                raise serializers.ValidationError({
                    "linked_project": "linked_project is required for entity_type='Project'."
                })
            data['linked_property'] = None
            data['linked_contact'] = None

        elif e_type == 'Contact':
            if not lc:
                raise serializers.ValidationError({
                    "linked_contact": "linked_contact is required for entity_type='Contact'."
                })
            data['linked_property'] = None
            data['linked_project'] = None

        else:  # Internal
            data['linked_property'] = None
            data['linked_project'] = None
            data['linked_contact'] = None

        return data
