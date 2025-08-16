from rest_framework import serializers
from .models import Project, Property, ProjectKeyDate
from contacts.models import Contact
from users.models import User
from contacts.serializers import ContactSerializer
from users.serializers import UserSerializer


class ProjectKeyDateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectKeyDate
        fields = ['id', 'label', 'due_date', 'remarks', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class ProjectSerializer(serializers.ModelSerializer):
    # Read-only nested display
    property_manager = UserSerializer(read_only=True)
    key_stakeholder = ContactSerializer(read_only=True)
    stakeholders = ContactSerializer(many=True, read_only=True)

    # Write-only fields for input
    property_manager_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='PROPERTY_MANAGER'),
        source='property_manager',
        write_only=True,
        required=False
    )
    key_stakeholder_id = serializers.PrimaryKeyRelatedField(
        queryset=Contact.objects.all(),
        source='key_stakeholder',
        write_only=True,
        required=False
    )
    stakeholder_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Contact.objects.all(),
        source='stakeholders',
        write_only=True
    )

    key_dates = ProjectKeyDateSerializer(many=True, required=False)

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'start_date', 'end_date',
            'project_type', 'project_status',
            'stakeholders', 'stakeholder_ids',
            'key_stakeholder', 'key_stakeholder_id',
            'expected_return', 'landmark', 'pincode', 'city',
            'district', 'state', 'country',
            'property_manager', 'property_manager_id',
            'company', 'key_dates',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = [ 'created_at', 'updated_at']

    def create(self, validated_data):
        key_dates_data = validated_data.pop('key_dates', [])
        stakeholders = validated_data.pop('stakeholders', [])

        project = Project.objects.create(**validated_data)
        project.stakeholders.set(stakeholders)

        for key_date in key_dates_data:
            ProjectKeyDate.objects.create(project=project, **key_date)

        return project

    def update(self, instance, validated_data):
        key_dates_data = validated_data.pop('key_dates', [])
        stakeholders = validated_data.pop('stakeholders', None)

        instance = super().update(instance, validated_data)

        if stakeholders is not None:
            instance.stakeholders.set(stakeholders)

        if key_dates_data:
            instance.key_dates.all().delete()
            for key_date in key_dates_data:
                ProjectKeyDate.objects.create(project=instance, **key_date)

        return instance


class PropertySerializer(serializers.ModelSerializer):
    project_name = serializers.ReadOnlyField(source='project.name')

    class Meta:
        model = Property
        fields = '__all__'
