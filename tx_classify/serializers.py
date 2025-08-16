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


def _q2(x: Decimal) -> Decimal:
    return (x or Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ClassificationSerializer(serializers.ModelSerializer):
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
            "remarks",
            "is_active_classification",
            "created_at",
        ]
        read_only_fields = ["classification_id", "is_active_classification", "created_at"]

    def validate(self, attrs):
        """
        - Default value_date to the bank transaction's date if not provided.
        - Ensure amount is positive and round to 2dp for consistency.
        """
        txn: BankTransaction = attrs["bank_transaction"]
        attrs["value_date"] = attrs.get("value_date") or txn.transaction_date

        amt = _q2(attrs.get("amount") or Decimal("0"))
        if amt <= 0:
            raise serializers.ValidationError("Amount must be greater than 0.")
        attrs["amount"] = amt
        return attrs


# ----- Split payloads -----

class SplitRowSerializer(serializers.Serializer):
    # REQUIRED due to NOT NULL constraints
    transaction_type_id = serializers.PrimaryKeyRelatedField(
        queryset=TransactionType.objects.all()
    )
    cost_centre_id = serializers.PrimaryKeyRelatedField(
        queryset=CostCentre.objects.all()
    )
    entity_id = serializers.PrimaryKeyRelatedField(
        queryset=Entity.objects.all()
    )

    # optional
    asset_id = serializers.PrimaryKeyRelatedField(
        queryset=Asset.objects.all(), allow_null=True, required=False
    )
    contract_id = serializers.PrimaryKeyRelatedField(
        queryset=Contract.objects.all(), allow_null=True, required=False
    )

    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    value_date = serializers.DateField(required=False, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class SplitRequestSerializer(serializers.Serializer):
    """
    Initial split of a bank transaction.
    NOTE: As originally implemented, this blocks if ANY active classification exists
    (i.e., no split after a prior classify/split). Kept as-is for backward compatibility.
    """
    bank_transaction_id = serializers.PrimaryKeyRelatedField(
        queryset=BankTransaction.objects.all()
    )
    rows = SplitRowSerializer(many=True)

    def validate(self, data):
        txn: BankTransaction = data["bank_transaction_id"]
        rows = data["rows"]
        if not rows:
            raise serializers.ValidationError("At least one split row is required.")

        # Each original txn can only be classified/split once (no recursive splits)
        if Classification.objects.filter(
            bank_transaction=txn, is_active_classification=True
        ).exists():
            raise serializers.ValidationError(
                "This transaction has already been classified/split once."
            )

        # Normalize amounts to 2dp and enforce > 0; also default value_date per row
        total = Decimal("0.00")
        for r in rows:
            amt = _q2(r["amount"])
            if amt <= 0:
                raise serializers.ValidationError("Each split amount must be greater than 0.")
            r["amount"] = amt  # write back normalized amount

            # default row value_date if missing
            if r.get("value_date") in (None, ""):
                r["value_date"] = txn.transaction_date

            total += amt

        expected = _q2(abs(txn.signed_amount or Decimal("0.00")))
        if _q2(total) != expected:
            raise serializers.ValidationError(
                f"Split total {_q2(total)} must equal transaction amount {expected}."
            )

        data["rows"] = rows
        return data


# ----- Re-split payloads (NEW) -----

class ResplitRequestSerializer(serializers.Serializer):
    """
    Re-split an **active child classification** into multiple active rows.
    - Only the targeted child is inactivated; siblings remain active.
    - Sum(rows.amount) must equal the child's amount (2dp; each > 0).
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
        for r in rows:
            amt = _q2(r["amount"])
            if amt <= 0:
                raise serializers.ValidationError("Each split amount must be greater than 0.")
            r["amount"] = amt

            if r.get("value_date") in (None, ""):
                r["value_date"] = child.value_date  # default to the child's value_date

            total += amt

        expected = _q2(child.amount or Decimal("0.00"))
        if _q2(total) != expected:
            raise serializers.ValidationError(
                f"Split total {_q2(total)} must equal selected child's amount {expected}."
            )

        data["rows"] = rows
        data["classification"] = child  # convenience for the View
        return data


# ----- Re-classify payloads (NEW) -----

class ReclassifyRequestSerializer(serializers.Serializer):
    """
    Re-classify an **active child classification** (change its metadata without changing amount).
    Creates a new active row with the same amount on the same bank_transaction and
    inactivates the selected child (audit trail).
    """
    classification_id = serializers.PrimaryKeyRelatedField(
        queryset=Classification.objects.filter(is_active_classification=True)
    )

    # required fields (NOT NULL in DB)
    transaction_type_id = serializers.PrimaryKeyRelatedField(
        queryset=TransactionType.objects.all()
    )
    cost_centre_id = serializers.PrimaryKeyRelatedField(
        queryset=CostCentre.objects.all()
    )
    entity_id = serializers.PrimaryKeyRelatedField(
        queryset=Entity.objects.all()
    )

    # optional
    asset_id = serializers.PrimaryKeyRelatedField(
        queryset=Asset.objects.all(), allow_null=True, required=False
    )
    contract_id = serializers.PrimaryKeyRelatedField(
        queryset=Contract.objects.all(), allow_null=True, required=False
    )
    value_date = serializers.DateField(required=False, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, data):
        child: Classification = data["classification_id"]
        # Default value_date to the child's value_date if not provided
        if data.get("value_date") in (None, ""):
            data["value_date"] = child.value_date
        data["classification"] = child  # convenience for the View
        return data
