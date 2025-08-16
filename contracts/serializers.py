from rest_framework import serializers
from .models import Contract, ContractMilestone

class ContractMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractMilestone
        fields = '__all__'

    def validate(self, data):
        status = data.get("status")
        amount = data.get("amount", 0)

        if status == "Paid" and (amount is None or amount <= 0):
            raise serializers.ValidationError("Milestone must have a positive amount before marking as Paid.")
        return data


class ContractSerializer(serializers.ModelSerializer):
    milestones = ContractMilestoneSerializer(many=True, required=False)

    # Additional display fields
    vendor_name = serializers.CharField(source='vendor.vendor_name', read_only=True)
    cost_centre_name = serializers.CharField(source='cost_centre.name', read_only=True)
    entity_name = serializers.CharField(source='entity.name', read_only=True)

    # Calculated fields
    total_contract_value = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    total_due = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = [
            'id', 'vendor', 'cost_centre', 'entity', 'description',
            'contract_date', 'start_date', 'end_date', 'document',
            'created_by', 'created_on', 'company', 'is_active',
            'milestones',
            'vendor_name', 'cost_centre_name', 'entity_name',
            'total_contract_value', 'total_paid', 'total_due'
        ]
        read_only_fields = ['created_by', 'created_on']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            user = request.user
            if user.role != "SUPER_USER":
                self.fields["company"] = serializers.PrimaryKeyRelatedField(
                    queryset=user.companies.all(),
                    required=True
                )
            else:
                self.fields["company"] = serializers.PrimaryKeyRelatedField(
                    queryset=Contract._meta.get_field('company').remote_field.model.objects.all(),
                    required=True
                )

    def validate_company(self, value):
        user = self.context["request"].user
        if user.role != "SUPER_USER" and value not in user.companies.all():
            raise serializers.ValidationError("You are not authorized to create contracts under this company.")
        return value

    def validate_document(self, value):
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("File size must not exceed 5MB.")
            valid_extensions = ['.pdf', '.jpg', '.jpeg', '.png']
            if not any(value.name.lower().endswith(ext) for ext in valid_extensions):
                raise serializers.ValidationError("Only PDF, JPG, JPEG, or PNG files are allowed.")
        return value

    def get_total_contract_value(self, obj):
        return sum((m.amount or 0) for m in obj.milestones.all())

    def get_total_paid(self, obj):
        return sum((m.amount or 0) for m in obj.milestones.filter(status="Paid"))

    def get_total_due(self, obj):
        return self.get_total_contract_value(obj) - self.get_total_paid(obj)

    def create(self, validated_data):
        milestones_data = validated_data.pop('milestones', [])
        contract = Contract.objects.create(**validated_data)
        for milestone in milestones_data:
            ContractMilestone.objects.create(contract=contract, **milestone)
        return contract

    def update(self, instance, validated_data):
        milestones_data = validated_data.pop('milestones', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
