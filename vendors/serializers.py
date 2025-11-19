from rest_framework import serializers
from .models import Vendor
from companies.models import Company
import re


class CompanyMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name"]


class VendorSerializer(serializers.ModelSerializer):
    # Accept company_id on writes; optional so PROPERTY_MANAGER can omit it
    company_id = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(),
        source="company",
        write_only=True,
        required=False,
        allow_null=True,
    )
    # Return full company on reads
    company = CompanyMiniSerializer(read_only=True)

    # --- IMPORTANT: override to disable model RegexValidators on blanks ---
    pan_number = serializers.CharField(required=False, allow_blank=True, allow_null=True, validators=[])
    gst_number = serializers.CharField(required=False, allow_blank=True, allow_null=True, validators=[])
    ifsc_code  = serializers.CharField(required=False, allow_blank=True, allow_null=True, validators=[])

    class Meta:
        model = Vendor
        fields = [
            "id",
            "vendor_name",
            "vendor_type",
            "pan_number",
            "gst_number",
            "contact_person",
            "phone_number",   # required by model/spec
            "email",
            "bank_name",
            "bank_account",
            "ifsc_code",
            "address",
            "notes",
            "is_active",
            "company",      # read
            "company_id",   # write
            "created_by",
            "created_on",
        ]
        read_only_fields = ["id", "created_on", "created_by", "company"]
        extra_kwargs = {
            # truly optional
            "contact_person": {"required": False, "allow_blank": True, "allow_null": True},
            "email":          {"required": False, "allow_null": True},
            "bank_name":      {"required": False, "allow_blank": True, "allow_null": True},
            "bank_account":   {"required": False, "allow_blank": True, "allow_null": True},
            "address":        {"required": False, "allow_blank": True, "allow_null": True},
            "notes":          {"required": False, "allow_blank": True, "allow_null": True},
            # still required by spec/model
            "vendor_name":    {"required": True},
            "vendor_type":    {"required": True},
            "phone_number":   {"required": True},
        }

    # -------- Normalize case/whitespace on optional IDs/Codes ----------
    def validate(self, attrs):
        for f in ("pan_number", "gst_number", "ifsc_code"):
            v = attrs.get(f)
            if v:
                attrs[f] = v.strip().upper()
        if "phone_number" in attrs and attrs["phone_number"]:
            attrs["phone_number"] = attrs["phone_number"].strip()
        return attrs

    # --------- Only validate formats when a value is provided ----------
    def validate_pan_number(self, value):
        if not value:  # None or ""
            return value
        if not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", value.strip().upper()):
            raise serializers.ValidationError("PAN must be like ABCDE1234F (10 chars).")
        return value.strip().upper()

    def validate_gst_number(self, value):
        if not value:
            return value
        if not re.fullmatch(r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]", value.strip().upper()):
            raise serializers.ValidationError("GST must be a valid 15-character code.")
        return value.strip().upper()

    def validate_ifsc_code(self, value):
        if not value:
            return value
        if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", value.strip().upper()):
            raise serializers.ValidationError("IFSC must be 11 chars (e.g. HDFC0XXXXXX).")
        return value.strip().upper()

    def validate_phone_number(self, value):
        # required; must be exactly 10 digits
        if not value:
            raise serializers.ValidationError("Phone number is required.")
        v = value.strip()
        if not (v.isdigit() and len(v) == 10):
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")
        return v

    def create(self, validated_data):
        # set created_by automatically
        request = self.context.get("request")
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            validated_data.setdefault("created_by", request.user)
        return super().create(validated_data)
