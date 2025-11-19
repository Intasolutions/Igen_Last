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
    expected_rent_this_month = serializers.DecimalField(max_digits=18, decimal_places=2)
    igen_sc_this_month = serializers.DecimalField(max_digits=18, decimal_places=2)
    inspections_30d = serializers.IntegerField()
    to_be_vacated_30d = serializers.IntegerField()


class OwnerRentalRowSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    property_name = serializers.CharField()
    status = serializers.CharField()  # Occupied / Vacant / Care / Sale
    rent = serializers.DecimalField(max_digits=16, decimal_places=2)
    igen_service_charge = serializers.DecimalField(max_digits=16, decimal_places=2)
    lease_start = serializers.DateField(allow_null=True)
    lease_expiry = serializers.DateField(allow_null=True)
    agreement_renewal_date = serializers.DateField(allow_null=True)
    inspection_date = serializers.DateField(allow_null=True)
    tenant_or_owner = serializers.CharField(allow_null=True, allow_blank=True)
    transaction_scheduled = serializers.BooleanField()
    email_sent = serializers.BooleanField()
    entity_id = serializers.IntegerField(allow_null=True, required=False)  # used by “Generate Statement”


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
