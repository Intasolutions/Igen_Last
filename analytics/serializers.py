# analytics/serializers.py
from rest_framework import serializers


# ---------- Shared / drilldown ----------
class LedgerRowSerializer(serializers.Serializer):
    value_date = serializers.DateField()
    txn_type = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    credit = serializers.DecimalField(max_digits=16, decimal_places=2)
    debit = serializers.DecimalField(max_digits=16, decimal_places=2)

    # Names
    entity = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    cost_centre = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    contract = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    asset = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    project = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    remarks = serializers.CharField(allow_null=True, allow_blank=True, required=False)

    # Running balance
    balance = serializers.DecimalField(max_digits=18, decimal_places=2)

    # Optional IDs (handy for FE drill links)
    entity_id = serializers.IntegerField(allow_null=True, required=False)
    cost_centre_id = serializers.IntegerField(allow_null=True, required=False)
    contract_id = serializers.IntegerField(allow_null=True, required=False)
    asset_id = serializers.IntegerField(allow_null=True, required=False)
    project_id = serializers.IntegerField(allow_null=True, required=False)


# ---------- R1: Entity Statement ----------
class EntityStatementRowSerializer(serializers.Serializer):
    date = serializers.DateField(source="value_date")
    transaction_type = serializers.CharField(
        source="txn_type", allow_null=True, allow_blank=True, required=False
    )
    credit = serializers.DecimalField(max_digits=16, decimal_places=2)
    debit = serializers.DecimalField(max_digits=16, decimal_places=2)
    balance = serializers.DecimalField(max_digits=18, decimal_places=2)
    remarks = serializers.CharField(allow_null=True, allow_blank=True, required=False)


# ---------- R2: M&I Entity Balances ----------
class EntityBalanceSerializer(serializers.Serializer):
    id = serializers.IntegerField(allow_null=True, required=False)   # for drilldown
    entity = serializers.CharField()
    balance = serializers.DecimalField(max_digits=18, decimal_places=2)


# ---------- R3: Owner Rental ----------
class OwnerRentalSummarySerializer(serializers.Serializer):
    total_properties = serializers.IntegerField()
    rented = serializers.IntegerField()
    vacant = serializers.IntegerField()
    care = serializers.IntegerField()
    sale = serializers.IntegerField()
    rent_to_be_collected = serializers.DecimalField(max_digits=18, decimal_places=2)
    rent_received = serializers.DecimalField(max_digits=18, decimal_places=2)
    rent_pending_collection = serializers.DecimalField(max_digits=18, decimal_places=2)
    igen_sc_this_month = serializers.DecimalField(max_digits=18, decimal_places=2) # This is Expected
    igen_sc_collected = serializers.DecimalField(max_digits=18, decimal_places=2)
    igen_sc_variance = serializers.DecimalField(max_digits=18, decimal_places=2)
    owner_recoverables_total = serializers.DecimalField(max_digits=18, decimal_places=2)
    owner_recoverables_base = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    owner_recoverables_margin = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    total_margin_collected = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_igen_income = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    igen_income_type_breakdown = serializers.ListField(child=serializers.DictField(), required=False)
    igen_income_cc_breakdown = serializers.ListField(child=serializers.DictField(), required=False)
    inspections_30d = serializers.IntegerField()
    inspections_due_5d = serializers.IntegerField()
    inspections_expired = serializers.IntegerField()
    renewals_30d = serializers.IntegerField()
    agreements_expired = serializers.IntegerField()
    to_be_vacated_30d = serializers.IntegerField()
    margin_breakdown = serializers.ListField(child=serializers.DictField(), required=False)
    total_igen_expenses = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    igen_expense_type_breakdown = serializers.ListField(child=serializers.DictField(), required=False)
    igen_expense_cc_breakdown = serializers.ListField(child=serializers.DictField(), required=False)


class OwnerRentalRowSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    property_name = serializers.CharField()
    status = serializers.CharField()  # Occupied / Vacant / Care / Sale

    # Editable master values
    base_rent = serializers.DecimalField(max_digits=16, decimal_places=2, required=False)
    base_igen_service_charge = serializers.DecimalField(max_digits=16, decimal_places=2, required=False)

    # Pro-rated display values
    rent = serializers.DecimalField(max_digits=16, decimal_places=2, required=False)
    igen_service_charge = serializers.DecimalField(max_digits=16, decimal_places=2, required=False)

    # Editable date fields
    lease_start = serializers.DateField(allow_null=True, required=False)
    lease_expiry = serializers.DateField(allow_null=True, required=False)
    agreement_renewal_date = serializers.DateField(allow_null=True, required=False)

    # Read-only inspection date
    inspection_date = serializers.DateField(allow_null=True, required=False)

    tenant_or_owner = serializers.CharField(allow_null=True, allow_blank=True, required=False)

    transaction_scheduled = serializers.BooleanField(required=False)
    # Alias so FE can use either key (txn_scheduled / transaction_scheduled)
    txn_scheduled = serializers.BooleanField(
        source="transaction_scheduled", required=False
    )
    email_sent = serializers.BooleanField(required=False)

    # Used by “Generate Statement” action in Owner Dashboard
    entity_id = serializers.IntegerField(allow_null=True, required=False)


# ---------- R4: Project Profitability ----------
class ProjectProfitRowSerializer(serializers.Serializer):
    project = serializers.CharField()
    inflows = serializers.DecimalField(max_digits=18, decimal_places=2)
    outflows = serializers.DecimalField(max_digits=18, decimal_places=2)
    net = serializers.DecimalField(max_digits=18, decimal_places=2)


# ---------- R5: Financial Dashboard (Pivot) ----------
class PivotTotalsSerializer(serializers.Serializer):
    credit = serializers.DecimalField(max_digits=18, decimal_places=2)
    debit = serializers.DecimalField(max_digits=18, decimal_places=2)
    margin = serializers.DecimalField(max_digits=18, decimal_places=2)
    # Included because the API returns this in totals
    balance = serializers.DecimalField(max_digits=18, decimal_places=2)
    # (If you don’t want to expose balance, remove this field and stop returning it in the view.)


class PivotResponseSerializer(serializers.Serializer):
    rows = serializers.ListField(child=serializers.DictField(), required=True)
    totals = PivotTotalsSerializer(allow_null=True, required=False)


class OwnerRentalPendingPropertySerializer(serializers.Serializer):
    property_id = serializers.IntegerField()
    property_name = serializers.CharField()
    tenant_name = serializers.CharField()
    monthly_rent = serializers.DecimalField(max_digits=18, decimal_places=2)
    expected_rent = serializers.DecimalField(max_digits=18, decimal_places=2)
    received_rent = serializers.DecimalField(max_digits=18, decimal_places=2)
    pending_amount = serializers.DecimalField(max_digits=18, decimal_places=2)


class OwnerRentalInspectionExpiryPropertySerializer(serializers.Serializer):
    property_id = serializers.IntegerField()
    property_name = serializers.CharField()
    inspection_date = serializers.DateField(allow_null=True)
    days_left = serializers.IntegerField()
    tenant_name = serializers.CharField()
    owner_name = serializers.CharField()
    project_manager = serializers.CharField()
class OwnerRentalAgreementExpiryPropertySerializer(serializers.Serializer):
    property_id = serializers.IntegerField()
    property_name = serializers.CharField()
    expiry_date = serializers.DateField(allow_null=True)
    days_left = serializers.IntegerField()
    tenant_name = serializers.CharField()
    owner_name = serializers.CharField()

class OwnerRentalServiceChargeBreakdownSerializer(serializers.Serializer):
    property_id = serializers.IntegerField(allow_null=True)
    property_name = serializers.CharField()
    tenant_name = serializers.CharField()
    expected_amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    collected_amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    variance = serializers.DecimalField(max_digits=18, decimal_places=2)
    details = serializers.ListField(child=serializers.DictField(), required=False) # For transaction-level breakdown per property

class OwnerRentalMaintenanceBreakdownSerializer(serializers.Serializer):
    property_id = serializers.IntegerField(allow_null=True)
    property_name = serializers.CharField()
    cost_centre = serializers.CharField()
    txn_type = serializers.CharField()
    base_amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    margin_amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_collectible = serializers.DecimalField(max_digits=18, decimal_places=2)
    date = serializers.DateField()
    remarks = serializers.CharField(allow_null=True, required=False)
    source = serializers.CharField() # BANK or CASH
