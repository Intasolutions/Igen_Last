# banks/serializers.py

from rest_framework import serializers
from .models import BankAccount  # FIXED: import the actual model name
from companies.models import Company
from companies.serializers import CompanySerializer  # so nested company can display properly

class BankAccountSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)  # nested company details for GET/display
    company_id = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(),
        write_only=True,
        source='company'
    )

    class Meta:
        model = BankAccount  # FIXED: use the actual model name
        fields = [
            'id',
            'company',      # nested details for display
            'company_id',   # used for create/update
            'account_name',
            'account_number',
            'bank_name',
            'ifsc',
            'is_active',
            'created_at',
        ]
