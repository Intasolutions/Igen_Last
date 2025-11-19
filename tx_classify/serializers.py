# tx_classify/serializers.py
from __future__ import annotations
from decimal import Decimal, ROUND_HALF_UP
from rest_framework import serializers

from bank_uploads.models import BankTransaction
from transaction_types.models import TransactionType
from cost_centres.models import CostCentre
from entities.models import Entity
from assets.models import Asset
from contracts.models import Contract

from .models import Classification


# ---------- helpers ----------

def _q2(x: Decimal) -> Decimal:
    return (x or Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _append_margin_to_remarks(remarks: str | None, margin: Decimal | None) -> str | None:
    """
    If a non-negative margin is provided, append a 'Margin: <amount>' note to remarks.
    Returns the updated remarks (or original if margin is None).
    """
    if margin is None:
        return remarks
    m = _q2(margin)
    if m < 0:
        # Normally we validate margin >= 0 in validate_margin below.
        raise serializers.ValidationError("Margin cannot be negative.")
    note = f"Margin: {m}"
    if (remarks or "").strip():
        return f"{remarks} | {note}"
    return note


# ---------- main serializer (single classify / read) ----------

class ClassificationSerializer(serializers.ModelSerializer):
    """
    Create/replace a single ACTIVE classification (no split).

    WRITE:
      - Accepts write-only `margin` and folds it into `remarks` (audit trail).
    READ:
      - Exposes `parsed_margin` (Decimal) parsed from remarks.
      - Exposes `cleaned_remarks` (remarks with 'Margin: ...' stripped out).
    """
    # write-only IDs → model relations
    bank_transaction_id = serializers.PrimaryKeyRelatedField(
        source="bank_transaction", queryset=BankTransaction.objects.all(), write_only=True
    )
    transaction_type_id = serializers.PrimaryKeyRelatedField(
        source="transaction_type", queryset=TransactionType.objects.all(), write_only=True
    )
    cost_centre_id = serializers.PrimaryKeyRelatedField(
        source="cost_centre", queryset=CostCentre.objects.all(), write_only=True
    )
    entity_id = serializers.PrimaryKeyRelatedField(
        source="entity", queryset=Entity.objects.all(), write_only=True
    )
    asset_id = serializers.PrimaryKeyRelatedField(
        source="asset", queryset=Asset.objects.all(), allow_null=True, required=False, write_only=True
    )
    contract_id = serializers.PrimaryKeyRelatedField(
        source="contract", queryset=Contract.objects.all(), allow_null=True, required=False, write_only=True
    )

    # NEW: optional margin (write-only; folded into remarks)
    margin = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, write_only=True)

    # NEW: read-only projections
    parsed_margin = serializers.SerializerMethodField(read_only=True)
    cleaned_remarks = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Classification
        fields = [
            "classification_id",      # read-only UUID PK
            "bank_transaction_id",
            "transaction_type_id",
            "cost_centre_id",
            "entity_id",
            "asset_id",
            "contract_id",
            "amount",
            "value_date",
            "remarks",                # raw DB remarks (may contain 'Margin: ...')
            "margin",                 # write-only incoming field
            "parsed_margin",          # read-only (from model.parsed_margin)
            "cleaned_remarks",        # read-only (from model.cleaned_remarks)
            "is_active_classification",
            "created_at",
        ]
        read_only_fields = [
            "classification_id",
            "is_active_classification",
            "created_at",
            "parsed_margin",
            "cleaned_remarks",
        ]

    # read helpers
    def get_parsed_margin(self, obj):
        return obj.parsed_margin

    def get_cleaned_remarks(self, obj):
        return obj.cleaned_remarks

    # write validation
    def validate_margin(self, v):
        if v is None:
            return v
        v = _q2(v)
        if v < 0:
            raise serializers.ValidationError("Margin cannot be negative.")
        return v

    def validate(self, attrs):
        """
        - Default value_date to the bank transaction's date if not provided.
        - Ensure amount is positive and round to 2dp for consistency.
        - If 'margin' provided, append it to remarks text.
        """
        txn: BankTransaction = attrs["bank_transaction"]
        attrs["value_date"] = attrs.get("value_date") or txn.transaction_date

        amt = _q2(attrs.get("amount") or Decimal("0"))
        if amt <= 0:
            raise serializers.ValidationError("Amount must be greater than 0.")
        attrs["amount"] = amt

        margin = attrs.pop("margin", None)  # consume margin so views won't see it
        if margin is not None:
            attrs["remarks"] = _append_margin_to_remarks(attrs.get("remarks"), margin)

        return attrs


# ---------- split payloads ----------

class SplitRowSerializer(serializers.Serializer):
    """
    One split row.
    All NOT NULL FKs required; optional asset/contract/value_date/remarks.
    NEW: optional 'margin' per row (folded into remarks upstream during validate).
    """
    # REQUIRED due to NOT NULL constraints
    transaction_type_id = serializers.PrimaryKeyRelatedField(queryset=TransactionType.objects.all())
    cost_centre_id = serializers.PrimaryKeyRelatedField(queryset=CostCentre.objects.all())
    entity_id = serializers.PrimaryKeyRelatedField(queryset=Entity.objects.all())

    # optional
    asset_id = serializers.PrimaryKeyRelatedField(queryset=Asset.objects.all(), allow_null=True, required=False)
    contract_id = serializers.PrimaryKeyRelatedField(queryset=Contract.objects.all(), allow_null=True, required=False)

    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    value_date = serializers.DateField(required=False, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    # NEW: optional margin
    margin = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)

    def validate_margin(self, v):
        if v is None:
            return v
        v = _q2(v)
        if v < 0:
            raise serializers.ValidationError("Margin cannot be negative.")
        return v


class SplitRequestSerializer(serializers.Serializer):
    """
    Split a bank transaction into multiple active classifications.

    CHANGE (2025-08-22):
    - Previously this serializer BLOCKED if ANY active classification existed for the txn.
      We REMOVED that guard so a transaction can be split/classified again.
    - IMPORTANT: The view should inactivate existing active classifications for the
      given bank transaction BEFORE creating the new rows (audit trail).

    NEW:
    - Accept optional `margin` on each row; it will be appended to the row's remarks.
    """
    bank_transaction_id = serializers.PrimaryKeyRelatedField(queryset=BankTransaction.objects.all())
    rows = SplitRowSerializer(many=True)

    def validate(self, data):
        txn: BankTransaction = data["bank_transaction_id"]
        rows = data["rows"]
        if not rows:
            raise serializers.ValidationError("At least one split row is required.")

        # Normalize amounts to 2dp and enforce > 0; also default value_date per row
        total = Decimal("0.00")
        normalized_rows = []
        for r in rows:
            # amount
            amt = _q2(r["amount"])
            if amt <= 0:
                raise serializers.ValidationError("Each split amount must be greater than 0.")
            r["amount"] = amt  # write back normalized amount

            # default row value_date if missing
            if r.get("value_date") in (None, ""):
                r["value_date"] = txn.transaction_date

            # append margin -> remarks (if provided)
            margin = r.pop("margin", None)
            if margin is not None:
                r["remarks"] = _append_margin_to_remarks(r.get("remarks"), margin)

            total += amt
            normalized_rows.append(r)

        expected = _q2(abs(txn.signed_amount or Decimal("0.00")))
        if _q2(total) != expected:
            raise serializers.ValidationError(
                f"Split total {_q2(total)} must equal transaction amount {expected}."
            )

        data["rows"] = normalized_rows
        return data


# ---------- re-split payloads (NEW) ----------

class ResplitRequestSerializer(serializers.Serializer):
    """
    Re-split an **active child classification** into multiple active rows.
    - Only the targeted child is inactivated; siblings remain active.
    - Sum(rows.amount) must equal the child's amount (2dp; each > 0).

    NEW:
    - Each row may include optional `margin` which is appended to remarks.
    """
    classification_id = serializers.PrimaryKeyRelatedField(
        queryset=Classification.objects.filter(is_active_classification=True)
    )
    rows = SplitRowSerializer(many=True)

    def validate(self, data):
        child: Classification = data["classification_id"]
        rows = data["rows"]
        if not rows:
            raise serializers.ValidationError("At least one split row is required.")

        # Normalize amounts and default per-row value_date based on the child value_date
        total = Decimal("0.00")
        normalized_rows = []
        for r in rows:
            amt = _q2(r["amount"])
            if amt <= 0:
                raise serializers.ValidationError("Each split amount must be greater than 0.")
            r["amount"] = amt

            if r.get("value_date") in (None, ""):
                r["value_date"] = child.value_date  # default to the child's value_date

            # append margin -> remarks (if provided)
            margin = r.pop("margin", None)
            if margin is not None:
                r["remarks"] = _append_margin_to_remarks(r.get("remarks"), margin)

            total += amt
            normalized_rows.append(r)

        expected = _q2(child.amount or Decimal("0.00"))
        if _q2(total) != expected:
            raise serializers.ValidationError(
                f"Split total {_q2(total)} must equal selected child's amount {expected}."
            )

        data["rows"] = normalized_rows
        data["classification"] = child  # convenience for the View
        return data


# ---------- re-classify payloads (NEW) ----------

class ReclassifyRequestSerializer(serializers.Serializer):
    """
    Re-classify an **active child classification** (change its metadata without changing amount).
    Creates a new active row with the same amount on the same bank_transaction and
    inactivates the selected child (audit trail).

    NEW:
    - Accept optional `margin` and append to `remarks`.
    """
    classification_id = serializers.PrimaryKeyRelatedField(
        queryset=Classification.objects.filter(is_active_classification=True)
    )

    # required fields (NOT NULL in DB)
    transaction_type_id = serializers.PrimaryKeyRelatedField(queryset=TransactionType.objects.all())
    cost_centre_id = serializers.PrimaryKeyRelatedField(queryset=CostCentre.objects.all())
    entity_id = serializers.PrimaryKeyRelatedField(queryset=Entity.objects.all())

    # optional
    asset_id = serializers.PrimaryKeyRelatedField(queryset=Asset.objects.all(), allow_null=True, required=False)
    contract_id = serializers.PrimaryKeyRelatedField(queryset=Contract.objects.all(), allow_null=True, required=False)
    value_date = serializers.DateField(required=False, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    # NEW: optional margin
    margin = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)

    def validate_margin(self, v):
        if v is None:
            return v
        v = _q2(v)
        if v < 0:
            raise serializers.ValidationError("Margin cannot be negative.")
        return v

    def validate(self, data):
        child: Classification = data["classification_id"]
        # Default value_date to the child's value_date if not provided
        if data.get("value_date") in (None, ""):
            data["value_date"] = child.value_date

        # fold margin into remarks (if provided)
        margin = data.pop("margin", None)
        if margin is not None:
            data["remarks"] = _append_margin_to_remarks(data.get("remarks"), margin)

        data["classification"] = child  # convenience for the View
        return data
