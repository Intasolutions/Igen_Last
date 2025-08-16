# tx_classify/views.py
from __future__ import annotations
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Count, Max, Q, Prefetch
from django.db.models.functions import Abs
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from bank_uploads.models import BankTransaction
from .models import Classification
from .serializers import (
    ClassificationSerializer,
    SplitRequestSerializer,
    ResplitRequestSerializer,       # NEW (already used)
    ReclassifyRequestSerializer,    # NEW
)

# ---------- helpers ----------
def _to_dec(v):
    if v is None or v == "":
        return None
    v = str(v).replace(",", "")
    return Decimal(v)

def _q2(x: Decimal) -> Decimal:
    return (x or Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# ---------- list view ----------
class UnclassifiedListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bank_account_id = request.query_params.get("bank_account_id")
        if not bank_account_id:
            return Response({"detail": "bank_account_id is required"}, status=400)

        qs = BankTransaction.objects.filter(
            bank_account_id=bank_account_id, is_deleted=False
        )

        sd = request.query_params.get("start_date")
        ed = request.query_params.get("end_date")
        if sd:
            qs = qs.filter(transaction_date__gte=sd)
        if ed:
            qs = qs.filter(transaction_date__lte=ed)

        include_children = (request.query_params.get("include_children", "0") in ("1", "true", "True"))
        flatten_splits = (request.query_params.get("flatten_splits", "0") in ("1", "true", "True"))

        qs = qs.annotate(
            abs_amount=Abs("signed_amount"),
            active_count=Count(
                "classifications",
                filter=Q(classifications__is_active_classification=True),
                distinct=True,
            ),
            last_classified_at=Max(
                "classifications__created_at",
                filter=Q(classifications__is_active_classification=True),
            ),
        )

        # amount filters
        min_amt = _to_dec(request.query_params.get("min_amount"))
        max_amt = _to_dec(request.query_params.get("max_amount"))
        if min_amt is not None:
            qs = qs.filter(abs_amount__gte=min_amt)
        if max_amt is not None:
            qs = qs.filter(abs_amount__lte=max_amt)

        # credit/debit filter
        t = (request.query_params.get("type") or "both").lower()
        if t == "credit":
            qs = qs.filter(signed_amount__gte=0)
        elif t == "debit":
            qs = qs.filter(signed_amount__lt=0)

        # Unclassified Only (default ON)
        unclassified_only = (request.query_params.get("unclassified_only", "1") in ("1", "true", "True"))
        if unclassified_only:
            qs = qs.filter(active_count=0)

        qs = qs.order_by("-transaction_date", "-created_at")

        # pagination
        try:
            limit = max(1, min(500, int(request.query_params.get("limit", 200))))
        except ValueError:
            limit = 200
        try:
            offset = max(0, int(request.query_params.get("offset", 0)))
        except ValueError:
            offset = 0

        page = qs[offset:offset + limit]

        # prefetch active classifications if needed
        if include_children or flatten_splits:
            active_children = Classification.objects.select_related(
                "transaction_type", "cost_centre", "entity", "asset", "contract"
            ).filter(is_active_classification=True)
            page = page.prefetch_related(Prefetch("classifications", queryset=active_children))

        results = []
        for tx in page:
            # flatten: replace split parents with their child rows
            if flatten_splits and tx.active_count and tx.active_count > 1:
                for c in tx.classifications.all():
                    results.append({
                        # parent (bank txn) info
                        "id": tx.id,
                        "transaction_date": tx.transaction_date,
                        "narration": tx.narration,
                        "credit_amount": tx.credit_amount,
                        "debit_amount": tx.debit_amount,
                        "balance_amount": tx.balance_amount,
                        "signed_amount": tx.signed_amount,
                        "utr_number": tx.utr_number,

                        # classification summary for display
                        "is_split_child": True,
                        "status": "Split Child",
                        "active_count": tx.active_count,
                        "last_classified_at": tx.last_classified_at,

                        "child": {
                            "classification_id": str(c.classification_id),
                            "amount": str(_q2(c.amount)),
                            "value_date": c.value_date,
                            "remarks": c.remarks or "",
                            "transaction_type": getattr(c.transaction_type, "name", None),
                            "cost_centre": getattr(c.cost_centre, "name", None),
                            "entity": getattr(c.entity, "name", None),
                            "asset": getattr(c.asset, "name", None) if c.asset_id else None,
                            "contract": getattr(c.contract, "vendor_name", None) if c.contract_id else None,
                        },
                    })
                continue  # skip adding the parent itself

            # normal (non-flattened) parent row
            if tx.active_count == 0:
                status_label = "Unclassified"
            elif tx.active_count == 1:
                status_label = "Classified"
            else:
                status_label = f"Split ({tx.active_count})"

            item = {
                "id": tx.id,
                "transaction_date": tx.transaction_date,
                "narration": tx.narration,
                "credit_amount": tx.credit_amount,
                "debit_amount": tx.debit_amount,
                "balance_amount": tx.balance_amount,
                "signed_amount": tx.signed_amount,
                "utr_number": tx.utr_number,
                "active_count": tx.active_count,
                "last_classified_at": tx.last_classified_at,
                "status": status_label,
            }
            if include_children:
                item["children"] = [{
                    "classification_id": str(c.classification_id),
                    "amount": str(_q2(c.amount)),
                    "value_date": c.value_date,
                    "remarks": c.remarks or "",
                    "transaction_type": getattr(c.transaction_type, "name", None),
                    "cost_centre": getattr(c.cost_centre, "name", None),
                    "entity": getattr(c.entity, "name", None),
                    "asset": getattr(c.asset, "name", None) if c.asset_id else None,
                    "contract": getattr(c.contract, "vendor_name", None) if c.contract_id else None,
                } for c in tx.classifications.all()]
            results.append(item)

        return Response(
            {"results": results, "count": qs.count(), "limit": limit, "offset": offset},
            status=200
        )


# ---------- single classify ----------
class ClassifySingleView(APIView):
    """
    Create one ACTIVE classification (no split) **only for UNCLASSIFIED transactions**.
    Requires tx_type / cost_centre / entity due to NOT NULL constraints.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = ClassificationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        txn: BankTransaction = ser.validated_data["bank_transaction"]
        amount: Decimal = ser.validated_data["amount"]

        # Only classify UNCLASSIFIED transactions
        if Classification.objects.filter(
            bank_transaction=txn,
            is_active_classification=True
        ).exists():
            return Response(
                {"detail": "This transaction is already classified or split. Only unclassified transactions can be classified."},
                status=400,
            )

        # must equal txn amount (2dp) and be positive
        expected = _q2(abs(txn.signed_amount or Decimal("0.00")))
        if _q2(amount) != expected or amount <= 0:
            return Response(
                {"detail": f"Amount must equal transaction amount {expected}."},
                status=400,
            )

        with transaction.atomic():
            Classification.objects.filter(
                bank_transaction=txn, is_active_classification=True
            ).update(is_active_classification=False)

            obj = Classification.objects.create(
                bank_transaction=txn,
                transaction_type=ser.validated_data["transaction_type"],
                cost_centre=ser.validated_data["cost_centre"],
                entity=ser.validated_data["entity"],
                asset=ser.validated_data.get("asset"),
                contract=ser.validated_data.get("contract"),
                amount=_q2(amount),
                value_date=ser.validated_data.get("value_date") or txn.transaction_date,
                remarks=ser.validated_data.get("remarks"),
                is_active_classification=True,
            )

        return Response(
            {"classification_id": str(obj.classification_id), "created_at": obj.created_at},
            status=201,
        )


# ---------- split ----------
class SplitTransactionView(APIView):
    """
    Split a transaction into multiple ACTIVE rows (initial split).
    All rows must include transaction_type / cost_centre / entity.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        req = SplitRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)

        txn: BankTransaction = req.validated_data["bank_transaction_id"]
        rows = req.validated_data["rows"]

        # BLOCK: if already split, do not allow splitting again here
        active_cnt = Classification.objects.filter(
            bank_transaction=txn, is_active_classification=True
        ).count()
        if active_cnt > 1:
            return Response(
                {"detail": "This transaction is already split and cannot be split again."},
                status=400,
            )

        total = _q2(sum((r["amount"] for r in rows), Decimal("0.00")))
        expected = _q2(abs(txn.signed_amount or Decimal("0.00")))
        if total != expected:
            return Response(
                {"detail": f"Split total {total} must equal transaction amount {expected}."},
                status=400,
            )

        with transaction.atomic():
            # audit trail: mark previous active rows inactive (can be 0 or 1 row)
            Classification.objects.filter(
                bank_transaction=txn, is_active_classification=True
            ).update(is_active_classification=False)

            new_rows = []
            for idx, r in enumerate(rows, start=1):
                amt = _q2(r["amount"])
                if amt <= 0:
                    return Response(
                        {"detail": "Each split amount must be greater than 0."},
                        status=400,
                    )
                new_rows.append(Classification(
                    bank_transaction=txn,
                    transaction_type=r["transaction_type_id"],
                    cost_centre=r["cost_centre_id"],  # fixed
                    entity=r["entity_id"],
                    asset=r.get("asset_id"),
                    contract=r.get("contract_id"),
                    amount=amt,
                    value_date=r.get("value_date") or txn.transaction_date,
                    remarks=(r.get("remarks") or f"Split part {idx}/{len(rows)}"),
                    is_active_classification=True,
                ))
            Classification.objects.bulk_create(new_rows, batch_size=500)

        return Response({"children_count": len(rows)}, status=201)


# ---------- re-split (NEW) ----------
class ResplitTransactionView(APIView):
    """
    Re-split an **active child classification** into multiple ACTIVE rows.
    Only the selected child is inactivated; other active siblings remain.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        req = ResplitRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)

        child: Classification = req.validated_data["classification"]
        rows = req.validated_data["rows"]
        txn = child.bank_transaction

        # safety checks
        if not child.is_active_classification:
            return Response({"detail": "Selected classification is not active."}, status=400)

        total = _q2(sum((r["amount"] for r in rows), Decimal("0.00")))
        expected = _q2(child.amount or Decimal("0.00"))
        if total != expected:
            return Response(
                {"detail": f"Split total {total} must equal selected child's amount {expected}."},
                status=400,
            )

        with transaction.atomic():
            # Inactivate ONLY the selected child
            Classification.objects.filter(
                classification_id=child.classification_id,
                is_active_classification=True,
            ).update(is_active_classification=False)

            # Create replacement rows as active lines on the SAME bank_transaction
            new_rows = []
            for idx, r in enumerate(rows, start=1):
                amt = _q2(r["amount"])
                if amt <= 0:
                    return Response(
                        {"detail": "Each split amount must be greater than 0."},
                        status=400,
                    )
                new_rows.append(Classification(
                    bank_transaction=txn,
                    transaction_type=r["transaction_type_id"],
                    cost_centre=r["cost_centre_id"],
                    entity=r["entity_id"],
                    asset=r.get("asset_id"),
                    contract=r.get("contract_id"),
                    amount=amt,
                    value_date=r.get("value_date") or child.value_date or txn.transaction_date,
                    remarks=(r.get("remarks") or f"Re-split part {idx}/{len(rows)}"),
                    is_active_classification=True,
                ))
            Classification.objects.bulk_create(new_rows, batch_size=500)

        return Response({"children_count": len(rows)}, status=201)


# ---------- re-classify (NEW) ----------
class ReclassifyClassificationView(APIView):
    """
    Re-classify an active child classification (change metadata WITHOUT changing amount).
    We inactivate the existing child row and create a single new active row on the same
    bank transaction with the same amount.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = ReclassifyRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        child: Classification = ser.validated_data["classification"]
        txn = child.bank_transaction

        with transaction.atomic():
            # inactivate selected child
            updated = Classification.objects.filter(
                classification_id=child.classification_id,
                is_active_classification=True,
            ).update(is_active_classification=False)
            if updated == 0:
                return Response({"detail": "Selected classification is not active."}, status=400)

            # create replacement with SAME amount, updated metadata
            obj = Classification.objects.create(
                bank_transaction=txn,
                transaction_type=ser.validated_data["transaction_type_id"],
                cost_centre=ser.validated_data["cost_centre_id"],
                entity=ser.validated_data["entity_id"],
                asset=ser.validated_data.get("asset_id"),
                contract=ser.validated_data.get("contract_id"),
                amount=_q2(child.amount),
                value_date=ser.validated_data.get("value_date") or child.value_date or txn.transaction_date,
                remarks=ser.validated_data.get("remarks"),
                is_active_classification=True,
            )

        return Response(
            {"classification_id": str(obj.classification_id), "created_at": obj.created_at},
            status=201,
        )
