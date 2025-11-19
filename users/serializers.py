# users/serializers.py
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from django.utils import timezone
from .models import User
from companies.models import Company


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name"]


# Lightweight user serializer for dropdowns / summaries
class UserLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "user_id"]


class UserSerializer(serializers.ModelSerializer):
    companies = CompanySerializer(many=True, read_only=True)
    company_ids = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(),
        many=True,
        write_only=True,
        source="companies",
        required=False,
    )
    # Not required by default; enforced in validate() for create
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "user_id",
            "full_name",
            "email",
            "password",
            "role",
            "companies",
            "company_ids",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_deleted",
            "created_at",
        ]
        read_only_fields = ["is_deleted", "created_at"]

    # ---- validation to handle role/company/password rules ----
    def validate(self, attrs):
        # Determine the role we're validating against (incoming or existing)
        role = attrs.get("role", getattr(self.instance, "role", None))

        # On create, password is required
        is_create = self.instance is None
        if is_create and not attrs.get("password"):
            raise ValidationError({"password": "Password is required."})

        # `company_ids` was mapped to 'companies' via source='companies'
        companies = attrs.get("companies", None)

        if role == "SUPER_USER":
            # SUPER_USER: ignore any companies assignment sent from client
            if "companies" in attrs:
                attrs.pop("companies", None)
        else:
            # For non-super roles, require at least one company on create,
            # or when companies are explicitly provided on update.
            if is_create:
                if not companies:
                    raise ValidationError(
                        {"company_ids": "At least one company is required for this role."}
                    )
            else:
                if "companies" in attrs and not companies:
                    raise ValidationError(
                        {"company_ids": "At least one company is required for this role."}
                    )

        return attrs

    def create(self, validated_data):
        # normalize email: empty string -> None
        email = validated_data.get("email")
        if email is not None and not str(email).strip():
            validated_data["email"] = None

        # normalize role form (e.g. "Center Head" -> "CENTER_HEAD")
        role = validated_data.get("role")
        if role:
            validated_data["role"] = str(role).upper().replace(" ", "_")

        companies = validated_data.pop("companies", [])
        password = validated_data.pop("password")  # validated in validate()

        user = User(**validated_data)

        # Never let this be NULL at insert time
        user.must_reset_password = True

        user.set_password(password)
        user.save()
        if companies:
            user.companies.set(companies)
        return user

    def update(self, instance, validated_data):
        companies = validated_data.pop("companies", None)
        password = validated_data.pop("password", None)

        # normalize email: empty string -> None
        if "email" in validated_data and not str(validated_data["email"] or "").strip():
            validated_data["email"] = None

        # normalize role casing if provided
        if "role" in validated_data and validated_data["role"]:
            validated_data["role"] = str(validated_data["role"]).upper().replace(" ", "_")

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
            # when password changes, clear first-login flag and stamp time
            instance.must_reset_password = False
            instance.password_changed_at = timezone.now()

        instance.save()

        # Only update companies if provided (and not SUPER_USER, which we popped in validate)
        if companies is not None:
            instance.companies.set(companies)

        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Accepts any of: user_id | username | email  + password
    and blocks login for soft-deleted users.
    """
    username_field = "user_id"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Allow alternative identifiers without failing field-level validation
        self.fields[self.username_field].required = False
        self.fields["username"] = serializers.CharField(required=False, allow_blank=True)
        # CharField so non-email text in email field doesn't blow up validation
        self.fields["email"] = serializers.CharField(required=False, allow_blank=True)

    def _coerce_credentials(self):
        """
        Accept {user_id|username|email, password} and return
        {user_id, password} for the parent class to validate.
        """
        incoming = dict(self.initial_data or {})

        # 1) provided user_id?
        candidate = (incoming.get("user_id") or "").strip()

        # 2) provided username?
        if not candidate and incoming.get("username"):
            candidate = (incoming["username"] or "").strip()

        # 3) provided email? -> may actually be user_id/username
        if not candidate and "email" in incoming:
            raw = (incoming.get("email") or "").strip()
            if raw:
                if "@" in raw:
                    # Looks like a real email: resolve to unique user_id if possible
                    qs = User.objects.filter(email__iexact=raw)
                    if qs.count() == 1:
                        candidate = qs.first().user_id
                    elif qs.count() > 1:
                        raise ValidationError({"email": "Multiple users found with this email."})
                    else:
                        # No such email; let auth fail cleanly (use the raw text)
                        candidate = raw
                else:
                    # Not an email → treat the value as user_id/username
                    candidate = raw

        if not candidate:
            raise ValidationError({self.username_field: "This field is required."})

        password = incoming.get("password")
        if not password:
            raise ValidationError({"password": "This field is required."})

        return {self.username_field: candidate, "password": password}

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["user_id"] = user.user_id
        # include first-time flag so frontend can redirect without extra call
        token["must_reset_password"] = bool(getattr(user, "must_reset_password", False))
        if user.role == "SUPER_USER":
            token["company_id"] = None
        else:
            companies = user.companies.all()
            token["company_id"] = companies[0].id if companies.exists() else None
        return token

    def validate(self, attrs):
        # Build proper creds from raw payload (username/email/user_id)
        coerced = self._coerce_credentials()
        data = super().validate(coerced)

        # Block login if soft-deleted
        if self.user.is_deleted:
            raise AuthenticationFailed("This account has been deleted.", code="user_deleted")

        # Extra response fields (mirrors get_token for convenience)
        data["user_id"] = self.user.user_id
        data["role"] = self.user.role
        data["must_reset_password"] = bool(getattr(self.user, "must_reset_password", False))
        if self.user.role == "SUPER_USER":
            data["company_id"] = None
        else:
            companies = self.user.companies.all()
            data["company_id"] = companies[0].id if companies.exists() else None
        return data
