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
            raise serializers.ValidationError(
                "Milestone must have a positive amount before marking as Paid."
            )
        return data


class ContractSerializer(serializers.ModelSerializer):
    # ---- Make Description mandatory and trimmed ----
    description = serializers.CharField(allow_blank=False, trim_whitespace=True)

    milestones = ContractMilestoneSerializer(many=True, required=False)
    document = serializers.FileField(required=False, allow_null=True)  # optional

    vendor_name = serializers.CharField(source='vendor.vendor_name', read_only=True)
    cost_centre_name = serializers.CharField(source='cost_centre.name', read_only=True)
    entity_name = serializers.CharField(source='entity.name', read_only=True)

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
            if getattr(user, "role", None) != "SUPER_USER":
                self.fields["company"] = serializers.PrimaryKeyRelatedField(
                    queryset=user.companies.all(),
                    required=True,
                )
            else:
                self.fields["company"] = serializers.PrimaryKeyRelatedField(
                    queryset=Contract._meta.get_field('company').remote_field.model.objects.all(),
                    required=True,
                )

    # ---------- Field validators ----------
    def validate_document(self, value):
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("File size must not exceed 5MB.")
            valid_extensions = ('.pdf', '.jpg', '.jpeg', '.png')
            if not value.name.lower().endswith(valid_extensions):
                raise serializers.ValidationError("Only PDF, JPG, JPEG, or PNG files are allowed.")
        return value

    # ---------- Computed totals ----------
    def get_total_contract_value(self, obj):
        return sum((m.amount or 0) for m in obj.milestones.all())

    def get_total_paid(self, obj):
        return sum((m.amount or 0) for m in obj.milestones.filter(status="Paid"))

    def get_total_due(self, obj):
        return self.get_total_contract_value(obj) - self.get_total_paid(obj)

    # ---------- Object-level validation ----------
    def validate(self, data):
        """
        Enforce mandatory description (non-empty after trim).
        """
        desc = (data.get("description", getattr(self.instance, "description", "")) or "").strip()
        if not desc:
            raise serializers.ValidationError({"description": "Description is required."})
        # normalize back the trimmed description
        data["description"] = desc
        return data

    # ---------- Create / Update ----------
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
        # milestones are managed via dedicated endpoints; no changes here
        return instance
