from rest_framework import serializers
from .models import Property, PropertyDocument, PropertyKeyDate
from companies.models import Company
from contacts.models import Contact


# ---------- Documents ----------
class PropertyDocumentSerializer(serializers.ModelSerializer):
    property = serializers.PrimaryKeyRelatedField(
        queryset=Property.objects.all(), write_only=True, required=True
    )

    class Meta:
        model = PropertyDocument
        fields = ["id", "property", "file_name", "file_url"]
        extra_kwargs = {
            "file_name": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        prop = attrs.get("property")
        if prop and prop.documents.count() >= 20:
            raise serializers.ValidationError("Maximum 20 documents per property.")
        return attrs


# ---------- Key Dates ----------
class PropertyKeyDateSerializer(serializers.ModelSerializer):
    property = serializers.PrimaryKeyRelatedField(
        queryset=Property.objects.all(), write_only=True, required=True
    )

    class Meta:
        model = PropertyKeyDate
        fields = ["id", "property", "date_label", "due_date", "remarks"]


# ---------- Property ----------
class PropertySerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all())
    company_name = serializers.ReadOnlyField(source="company.name")

    # Landlord FK
    landlord = serializers.PrimaryKeyRelatedField(
        queryset=Contact.objects.all(), required=False, allow_null=True
    )
    landlord_display = serializers.SerializerMethodField()

    # Project Manager FK (NEW)
    project_manager = serializers.PrimaryKeyRelatedField(
        queryset=Contact.objects.all(), required=False, allow_null=True
    )
    project_manager_display = serializers.SerializerMethodField()

    # NEW canonical tenant FK comes from/to "tenant_contact" on the model,
    # but the API field is still named "tenant" for the frontend.
    tenant = serializers.PrimaryKeyRelatedField(
        source="tenant_contact",
        queryset=Contact.objects.all(),
        required=False,
        allow_null=True,
    )
    tenant_display = serializers.SerializerMethodField()

    # Expose legacy text (read-only) so you can still see old data
    tenant_legacy = serializers.ReadOnlyField(source="tenant")

    # Related read-only arrays
    document_urls = PropertyDocumentSerializer(
        many=True, read_only=True, source="documents"
    )
    key_dates = PropertyKeyDateSerializer(many=True, read_only=True)

    is_active_display = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            # Identity / company
            "id",
            "company",
            "company_name",
            "name",
            "location",

            # Purpose / status
            "purpose",
            "status",
            "is_active",
            "is_active_display",

            # Contacts
            "landlord",
            "landlord_display",
            "project_manager",         # NEW
            "project_manager_display", # NEW
            "tenant",                  # FK (maps to tenant_contact)
            "tenant_display",
            "tenant_legacy",           # old text, read-only

            # Config
            "config_bhk",
            "config_bathroom",
            "property_type",
            "build_up_area_sqft",
            "land_area_cents",

            # Financials
            "expected_rent",
            "monthly_rent",
            "lease_start_date",
            "lease_end_date",
            "next_inspection_date",
            "expected_sale_price",
            "expected_price",
            "igen_service_charge",

            # Type-specific extras
            "balconies",
            "car_parks",
            "furnishing",
            "floor_height",
            "front_facing",
            "amenities",
            "highlight",
            "gated_community",
            "approach_road_width",

            # Address / remarks
            "address_line1",
            "address_line2",
            "city",
            "pincode",
            "state",
            "country",
            "remarks",

            # Related
            "document_urls",
            "key_dates",
        ]

    # ---------- helpers ----------
    def get_is_active_display(self, obj):
        return "Active" if getattr(obj, "is_active", True) else "Inactive"

    def _contact_to_dict(self, contact):
        if not contact:
            return None
        return {
            "contact_id": getattr(contact, "contact_id", getattr(contact, "id", None)),
            "full_name": getattr(contact, "full_name", None),
            "email": getattr(contact, "email", None),
        }

    def get_landlord_display(self, obj):
        return self._contact_to_dict(getattr(obj, "landlord", None))

    def get_project_manager_display(self, obj):
        return self._contact_to_dict(getattr(obj, "project_manager", None))

    def get_tenant_display(self, obj):
        return self._contact_to_dict(getattr(obj, "tenant_contact", None))

    # ---------- validation ----------
    def validate(self, data):
        """
        Minimal requireds: company, name, location, landlord
        Purpose↔Status allowed values
        Rental dates sanity
        Pincode format
        Soft rule: apartment shouldn't carry land area (clear it)
        """
        instance = getattr(self, "instance", None)

        # Required fields
        required = ["company", "name", "location", "landlord"]
        for f in required:
            value = data.get(f, getattr(instance, f, None) if instance else None)
            if not value:
                raise serializers.ValidationError({f: f"{f.replace('_', ' ').title()} is required"})

        # Purpose/Status mapping
        PURPOSE_STATUS = {
            "care": {"occupied", "vacant", "under maintenance"},
            "rental": {"occupied", "vacant", "under maintenance"},
            "sale": {"owner occupied", "tenant occupied", "vacant", "under maintenance"},
        }
        purpose = data.get("purpose", getattr(instance, "purpose", None) if instance else None)
        status = data.get("status", getattr(instance, "status", None) if instance else None)
        if purpose and status:
            allowed = PURPOSE_STATUS.get(purpose, set())
            if allowed and status not in allowed:
                raise serializers.ValidationError(
                    {"status": f"Status '{status}' not valid for purpose '{purpose}'"}
                )

        # Tenant is OPTIONAL now – no enforced requirement

        # Rental date sanity
        lease_start = data.get("lease_start_date", getattr(instance, "lease_start_date", None) if instance else None)
        lease_end = data.get("lease_end_date", getattr(instance, "lease_end_date", None) if instance else None)
        next_insp = data.get("next_inspection_date", getattr(instance, "next_inspection_date", None) if instance else None)

        eff_purpose = (purpose or "").lower() if purpose else ""
        if eff_purpose == "rental" and lease_start:
            if lease_end and lease_end <= lease_start:
                raise serializers.ValidationError({"lease_end_date": "Lease End must be after Start"})
            if next_insp and next_insp <= lease_start:
                raise serializers.ValidationError({"next_inspection_date": "Inspection must be after Start"})

        # Pincode format (6 digits)
        pin = data.get("pincode", getattr(instance, "pincode", None) if instance else None)
        if pin:
            s = str(pin).strip()
            if not (s.isdigit() and len(s) == 6):
                raise serializers.ValidationError({"pincode": "Pincode must be 6 digits"})

        # Soft rule: apartment shouldn't carry land area
        prop_type = data.get("property_type", getattr(instance, "property_type", None) if instance else None)
        if prop_type == "apartment" and data.get("land_area_cents") is not None:
            if "land_area_cents" in data:
                data["land_area_cents"] = None

        return data

    # ---------- persistence ----------
    def create(self, validated_data):
        return Property.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance
