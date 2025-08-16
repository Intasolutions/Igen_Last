from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from .models import User
from companies.models import Company


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'name']


class UserSerializer(serializers.ModelSerializer):
    companies = CompanySerializer(many=True, read_only=True)
    company_ids = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(),
        many=True,
        write_only=True,
        source='companies',
        required=False,
    )
    # NOTE: not required by default; enforced in validate() for create
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'id', 'user_id', 'full_name', 'password', 'role',
            'companies', 'company_ids', 'is_active', 'is_staff', 'is_superuser',
            'is_deleted', 'created_at',
        ]
        read_only_fields = ['is_deleted', 'created_at']

    # ---- validation to handle role/company/password rules ----
    def validate(self, attrs):
        # Determine the role we're validating against (incoming or existing)
        role = attrs.get('role', getattr(self.instance, 'role', None))

        # On create, password is required
        is_create = self.instance is None
        if is_create and not attrs.get('password'):
            raise ValidationError({'password': 'Password is required.'})

        # `company_ids` was mapped to 'companies' via source='companies'
        companies = attrs.get('companies', None)

        if role == 'SUPER_USER':
            # SUPER_USER: ignore any companies assignment sent from client
            if 'companies' in attrs:
                attrs.pop('companies', None)
        else:
            # For non-super roles, require at least one company on create,
            # or when companies are explicitly provided on update.
            if is_create:
                if not companies:
                    raise ValidationError({'company_ids': 'At least one company is required for this role.'})
            else:
                if 'companies' in attrs and not companies:
                    raise ValidationError({'company_ids': 'At least one company is required for this role.'})

        return attrs

    def create(self, validated_data):
        companies = validated_data.pop('companies', [])
        password = validated_data.pop('password')  # validated in validate()
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if companies:
            user.companies.set(companies)
        return user

    def update(self, instance, validated_data):
        companies = validated_data.pop('companies', None)
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        # Only update companies if provided (and not SUPER_USER, which we popped in validate)
        if companies is not None:
            instance.companies.set(companies)

        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'user_id'

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['user_id'] = user.user_id

        # 🔐 If SUPER_USER, skip company enforcement
        if user.role == 'SUPER_USER':
            token['company_id'] = None
        else:
            companies = user.companies.all()
            token['company_id'] = companies[0].id if companies.exists() else None

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # 🚫 Block login if user is soft-deleted
        if self.user.is_deleted:
            raise AuthenticationFailed('This account has been deleted.', code='user_deleted')

        data['user_id'] = self.user.user_id
        data['role'] = self.user.role

        # 🔐 If SUPER_USER, no company is required
        if self.user.role == 'SUPER_USER':
            data['company_id'] = None
        else:
            companies = self.user.companies.all()
            data['company_id'] = companies[0].id if companies.exists() else None

        return data
