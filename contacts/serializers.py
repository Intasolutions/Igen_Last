# contacts/serializers.py
from rest_framework import serializers
from .models import Contact
from properties.models import Property


class PropertyLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Property
        fields = ["id", "name"]


class ContactSerializer(serializers.ModelSerializer):
    """
    - Returns nested `linked_properties` read-only (id + name)
    - Accepts write-only `linked_property_ids` (list of PKs) to set M2M
    - Adds computed `company_name`
    """
    linked_properties = PropertyLiteSerializer(many=True, read_only=True)

    linked_property_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Property.objects.all(),
        write_only=True,
        source="linked_properties",
        required=False,
    )

    created_by = serializers.StringRelatedField(read_only=True)
    company_name = serializers.ReadOnlyField(source="company.name")

    # ---- PAN: allow blank/null from the client and normalize to NULL ----
    pan = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        default=None,
    )

    class Meta:
        model = Contact
        fields = [
            "contact_id",
            "full_name",
            "type",
            "stakeholder_types",  # JSON/list
            "company",
            "company_name",
            "phone",
            "alternate_phone",
            "email",
            "address",
            "pan",
            "gst",
            "notes",
            "landmark",
            "pincode",
            "city",
            "district",
            "state",
            "country",
            "linked_properties",     # read-only nested
            "linked_property_ids",   # write-only ids
            "created_at",
            "updated_at",
            "created_by",
            "is_active",
        ]

    # -------- Field-level validators --------
    def validate_phone(self, value):
        """
        Prevent duplicate phone numbers with a clear message.
        Uses exact-string comparison to match the DB uniqueness.
        """
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Phone number is required.")

        qs = Contact.objects.all()
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.filter(phone=v).exists():
            raise serializers.ValidationError("This mobile number is already in use.")
        return v

    def validate_pan(self, value):
        # Normalize: treat empty/None as no PAN, otherwise uppercase
        v = (value or "").strip().upper()
        if not v:
            return None  # store NULL in DB (prevents unique='' conflicts)

        # Keep PAN unique if provided; ignore current instance on update
        qs = Contact.objects.exclude(
            pk=self.instance.pk if self.instance else None
        ).filter(pan=v)
        if qs.exists():
            raise serializers.ValidationError("PAN must be unique.")
        return v

    # -------- Object-level validator --------
    def validate(self, data):
        contact_type = data.get("type", getattr(self.instance, "type", None))
        gst = (data.get("gst", getattr(self.instance, "gst", "")) or "").strip().upper()

        stakeholder_types = data.get(
            "stakeholder_types", getattr(self.instance, "stakeholder_types", None)
        )

        if not stakeholder_types:
            raise serializers.ValidationError(
                {"stakeholder_types": "At least one stakeholder type is required."}
            )

        if contact_type == "Company" and not gst:
            raise serializers.ValidationError(
                {"gst": "GST number is required for Company type contacts."}
            )

        # Ensure pan remains None if blank/empty
        if data.get("pan") in ("", None):
            data["pan"] = None

        data["gst"] = gst  # normalized
        return data
