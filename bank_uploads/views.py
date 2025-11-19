# bank_uploads/views.py
from __future__ import annotations

import csv
import re
import hashlib
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from io import StringIO
from typing import Dict, List, Optional, Tuple

from django.db import transaction
from django.db.models import Sum
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BankTransaction, BankUploadBatch
from .serializers import (
    BankUploadBatchSerializer,
    BankTransactionSerializer,
)

# ---------- Header mapping & parsing helpers ----------

# canonical -> list of synonyms (lowercased, trimmed)
HEADER_MAP: Dict[str, List[str]] = {
    # dates
    "date": [
        "date", "transaction date", "value date", "posting date",
        "tran date", "txn date", "value dt", "val dt",
    ],
    # narration/desc
    "narration": [
        "narration", "description", "details", "particulars", "remarks", "transaction remarks",
        "narration/description",
    ],
    # amounts split
    "credit": [
        "credit", "cr", "deposit", "credit amount", "cr amount",
        "deposit amt.", "deposit amt", "deposit amount", "deposit (cr)",
    ],
    "debit": [
        "debit", "dr", "withdrawal", "debit amount", "dr amount",
        "withdrawal amt.", "withdrawal amt", "withdrawal amount", "withdrawal (dr)",
    ],
    # running/closing balance
    "balance": [
        "balance", "running balance", "closing balance", "available balance",
        "balance amt.", "balance amount", "closing bal", "available bal",
    ],
    # references / UTR / cheque
    "utr": [
        "utr", "utr number", "utr no", "utr#", "reference", "transaction id",
        "ref no", "chq/ref no", "cheque/ref no", "reference no", "ref#", "rrn", "upi ref no",
    ],
    # optional: some banks give Type + Amount instead of separate debit/credit
    "type": ["type", "txn type", "transaction type", "dr/cr", "cr/dr"],
    "amount": ["amount", "txn amount", "transaction amount", "amt."],
}

DATE_FORMATS = [
    "%d-%b-%y",  # 06-Aug-25
    "%d-%b-%Y",  # 06-Aug-2025
    "%d/%m/%Y",
    "%Y-%m-%d",
    "%d-%m-%Y",
    "%d.%m.%Y",
]

def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()

def _canon_text(s: Optional[str]) -> str:
    """Match model's narration/UTR normalization (compress spaces + lowercase)."""
    return " ".join((s or "").split()).lower()

def _q2(x: Decimal | None) -> Decimal:
    """Quantize to 2dp exactly like the model does."""
    return (x or Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def _dedupe_key(date, narration, signed_amount, utr):
    """Build the same SHA256 dedupe key the model uses (with 2dp)."""
    payload = "|".join([
        date.isoformat(),
        _canon_text(narration),
        format(_q2(signed_amount), "f"),
        _canon_text(utr),
    ])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

_UTR_RE = re.compile(
    r'(?:UTR|RRN|REF(?:ERENCE)?|CHQ/REF\s*NO|TRANSACTION\s*ID|UPI\s*(?:REF)?\s*NO)'
    r'\s*[:#\-]?\s*([A-Z0-9]{8,20})',
    re.I
)

def _extract_ref_from_narration(narr: str) -> Optional[str]:
    m = _UTR_RE.search(narr or "")
    return m.group(1) if m else None

def _map_headers(fieldnames: List[str]) -> Dict[str, str]:
    present = {_norm(c): c for c in fieldnames or []}
    result: Dict[str, str] = {}
    for canonical, aliases in HEADER_MAP.items():
        for alias in aliases:
            if alias in present:
                result[canonical] = present[alias]
                break
    return result

def _parse_date_or_raise(value: str):
    v = (value or "").strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date format: {value!r}")

def _to_decimal(val: Optional[str]) -> Optional[Decimal]:
    if val is None:
        return None
    s = str(val).strip()
    if not s or _norm(s) in {"na", "n/a", "null", "-"}:
        return None
    # remove currency marks and thousands separators
    s = (
        s.replace("₹", "")
         .replace("INR", "")
         .replace(",", "")
         .replace("\u00a0", " ")
         .strip()
    )
    # handle parentheses = negative e.g. (1,234.50)
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    return Decimal(s)

def _balance_continuity(rows: List[dict]) -> bool:
    if not rows:
        return True
    prev_balance = _q2(rows[0]["balance_amount"] - rows[0]["signed_amount"])
    for r in rows:
        expected = _q2(prev_balance + _q2(r["signed_amount"]))
        if expected != _q2(r["balance_amount"]):
            return False
        prev_balance = _q2(r["balance_amount"])
    return True

# --- New: robust continuity helpers (auto-detect asc/desc) ---
def _check_continuity(seq: List[dict]) -> Tuple[bool, Optional[Decimal]]:
    """
    Returns (ok, opening_balance) for a given sequence order.
    opening_balance is the balance BEFORE the first row in seq.
    """
    if not seq:
        return True, None
    prev_balance = _q2(seq[0]["balance_amount"] - seq[0]["signed_amount"])
    for r in seq:
        expected = _q2(prev_balance + _q2(r["signed_amount"]))
        if expected != _q2(r["balance_amount"]):
            return False, None
        prev_balance = _q2(r["balance_amount"])
    return True, _q2(seq[0]["balance_amount"] - seq[0]["signed_amount"])

def _continuity_and_opening(rows: List[dict]) -> Tuple[bool, Optional[Decimal], List[dict]]:
    """
    Try continuity in the given order; if it fails, try the reverse.
    Returns (ok, opening_balance, used_order_rows)
    """
    ok, opening = _check_continuity(rows)
    if ok:
        return True, opening, rows
    ok2, opening2 = _check_continuity(list(reversed(rows)))
    if ok2:
        return True, opening2, list(reversed(rows))
    return False, None, rows

# ---------- Endpoints ----------

class UploadBankTransactionsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        """
        multipart/form-data:
          - file: CSV
          - bank_account_id: int

        Built to accept bank "Full Statement" CSVs with headers like:
          ['Sr.No.', 'Date', 'Type', 'Description', 'Debit', 'Credit', 'Balance']
        plus common variants (Value Dt, Withdrawal Amt., Deposit Amt., Chq/Ref No, etc).
        """
        file = request.FILES.get("file")
        bank_account_id = request.data.get("bank_account_id")

        if not bank_account_id:
            return Response({"detail": "bank_account_id is required"}, status=400)
        if not file:
            return Response({"detail": "file is required"}, status=400)

        # ---- light format guard: CSV only (spec) ----
        name_l = (file.name or "").lower()
        if not (name_l.endswith(".csv")):
            return Response({"detail": "Only CSV files are supported."}, status=400)

        batch = BankUploadBatch.objects.create(
            bank_account_id=bank_account_id,
            file_name=file.name,
            uploaded_by=request.user if request.user.is_authenticated else None,
        )

        # --- Robust CSV open: handle BOMs, sniff delimiter, trim spaces ---
        try:
            file_bytes = file.read()
            sample = file_bytes[:4096].decode("utf-8-sig", errors="ignore")
            try:
                dialect = csv.Sniffer().sniff(sample)
            except Exception:
                dialect = csv.excel  # default to comma

            wrapped = StringIO(file_bytes.decode("utf-8-sig", errors="ignore"))
            reader = csv.DictReader(wrapped, dialect=dialect, skipinitialspace=True)
            header_map = _map_headers(reader.fieldnames or [])
        except Exception as e:
            batch.errors_count = 1
            batch.save(update_fields=["errors_count"])
            return Response({"detail": f"Invalid file: {e}"}, status=400)

        required = {"date", "narration", "balance"}
        missing = [k for k in required if k not in header_map]
        if missing:
            batch.errors_count = 1
            batch.save(update_fields=["errors_count"])
            return Response(
                {
                    "detail": f"Missing required column(s): {', '.join(missing)}",
                    "detected_headers": reader.fieldnames,
                },
                status=400,
            )

        parsed_rows: List[dict] = []
        errors = 0

        for idx, raw in enumerate(reader, start=2):  # header is row 1
            try:
                date_val = raw.get(header_map["date"], "")
                narration_val = raw.get(header_map["narration"], "")
                balance_val = raw.get(header_map["balance"], "")

                credit_val = raw.get(header_map.get("credit", ""), None) if "credit" in header_map else None
                debit_val = raw.get(header_map.get("debit", ""), None) if "debit" in header_map else None
                utr_val = raw.get(header_map.get("utr", ""), None) if "utr" in header_map else None
                type_val = raw.get(header_map.get("type", ""), None) if "type" in header_map else None
                amount_val = raw.get(header_map.get("amount", ""), None) if "amount" in header_map else None

                # date (strict)
                transaction_date = _parse_date_or_raise(date_val)

                narration = narration_val
                balance = _to_decimal(balance_val) or Decimal("0")
                credit = _to_decimal(credit_val)
                debit = _to_decimal(debit_val)
                utr = (utr_val or "").strip() or None

                # If only "Type (CR/DR)" + "Amount" is present
                if credit is None and debit is None and (amount_val is not None) and (type_val is not None):
                    amt = _to_decimal(amount_val) or Decimal("0")
                    t = _norm(type_val)
                    if t in {"cr", "credit"}:
                        credit = amt
                    elif t in {"dr", "debit"}:
                        debit = amt

                if credit is not None:
                    signed = credit
                elif debit is not None:
                    signed = Decimal("0") - debit
                else:
                    signed = Decimal("0")
                signed = _q2(signed)  # <-- important: match model

                parsed_rows.append({
                    "transaction_date": transaction_date,
                    "narration": narration,
                    "credit_amount": credit,
                    "debit_amount": debit,
                    "balance_amount": balance,
                    "utr_number": utr,
                    "signed_amount": signed,
                })
            except Exception:
                errors += 1  # skip bad rows

        # --- Continuity checks (MUST pass) ---
        continuity_ok, opening_balance, used_rows = _continuity_and_opening(parsed_rows)
        prev_match = True
        if used_rows:
            prev_tx = (
                BankTransaction.objects
                .filter(bank_account_id=bank_account_id)
                .order_by("-transaction_date", "-created_at")
                .first()
            )
            if prev_tx:
                prev_match = (_q2(prev_tx.balance_amount) == _q2(opening_balance or Decimal("0")))

        batch.balance_continuity_in_file = bool(continuity_ok)
        batch.previous_ending_balance_match = bool(prev_match)

        # HARD STOP if continuity fails
        if not (continuity_ok and prev_match):
            batch.uploaded_count = 0
            batch.skipped_count = 0
            batch.errors_count = errors + 1  # count the continuity failure
            batch.save(update_fields=[
                "uploaded_count", "skipped_count", "errors_count",
                "balance_continuity_in_file", "previous_ending_balance_match",
            ])

            reason = []
            if not continuity_ok:
                reason.append("Balance continuity failed within the file.")
            if not prev_match:
                reason.append("Previous ending balance does not match this file's opening balance.")

            payload = BankUploadBatchSerializer(batch).data
            payload.update({
                "upload_batch_id": str(batch.id),
                "uploaded": 0,
                "skipped_duplicates": 0,
                "balance_continuity": "Invalid",
                "opening_balance_in_file": str(opening_balance) if opening_balance is not None else None,
                "errors": reason,
            })
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        # ---------- Pre-filter duplicates (DB + within-file) ----------
        candidates = []
        all_keys = set()
        for idx, r in enumerate(used_rows, start=2):  # use validated order
            # prefer explicit UTR, else try to extract from narration
            best_utr = (r["utr_number"] or _extract_ref_from_narration(r["narration"]) or "").strip()
            k_main  = _dedupe_key(r["transaction_date"], r["narration"], r["signed_amount"], best_utr)
            k_empty = _dedupe_key(r["transaction_date"], r["narration"], r["signed_amount"], "")
            candidates.append((idx, r, best_utr, {k_main, k_empty}))
            all_keys |= {k_main, k_empty}

        # Existing active keys for this account
        existing_keys = set(
            BankTransaction.objects.filter(
                bank_account_id=bank_account_id,
                dedupe_key__in=list(all_keys)
            ).values_list("dedupe_key", flat=True)
        )

        kept_rows: List[tuple] = []
        skipped_rows: List[dict] = []
        seen_in_file = set()

        for rownum, r, best_utr, keys in candidates:
            # skip if present in DB or duplicated inside this file
            if (keys & existing_keys) or (keys & seen_in_file):
                skipped_rows.append({
                    "row": rownum,
                    "error": "Duplicate",
                    "transaction_date": str(r["transaction_date"]),
                    "narration": r["narration"],
                    "credit_amount": str(r["credit_amount"]or ""),
                    "debit_amount": str(r["debit_amount"] or ""),
                    "balance_amount": str(r["balance_amount"]),
                    "utr_number": best_utr or "",
                })
                continue
            kept_rows.append((r, best_utr))
            seen_in_file |= keys

        # Build objects only for non-duplicates
        objs: List[BankTransaction] = []
        for r, best_utr in kept_rows:
            objs.append(BankTransaction(
                bank_account_id=bank_account_id,
                upload_batch=batch,
                transaction_date=r["transaction_date"],
                narration=r["narration"],
                credit_amount=r["credit_amount"],
                debit_amount=r["debit_amount"],
                balance_amount=r["balance_amount"],
                utr_number=(best_utr or None),
                signed_amount=r["signed_amount"],  # recomputed in save, but set here for consistency
                source="BANK",
            ))

        with transaction.atomic():
            # Precompute derived fields since bulk_create skips model.save()
            for o in objs:
                o.signed_amount = o._compute_signed_amount()
                o.dedupe_key = o._build_dedupe_key()

            inserted = BankTransaction.all_objects.bulk_create(
                objs, ignore_conflicts=True, batch_size=1000
            )
            created = len(inserted)
            # include any extra conflicts caught by DB (very rare but possible in races)
            db_conflict_skipped = max(0, len(objs) - created)
            prefilter_skipped = len(used_rows) - len(kept_rows)
            skipped = prefilter_skipped + db_conflict_skipped

            batch.uploaded_count = created
            batch.skipped_count = skipped
            batch.errors_count = errors
            batch.save(update_fields=[
                "uploaded_count", "skipped_count", "errors_count",
                "balance_continuity_in_file", "previous_ending_balance_match",
            ])

        # Frontend expects these fields
        payload = BankUploadBatchSerializer(batch).data
        payload["upload_batch_id"] = str(batch.id)
        payload["uploaded"] = created
        payload["skipped_duplicates"] = skipped
        payload["skipped_rows"] = skipped_rows
        payload["balance_continuity"] = "Valid"
        return Response(payload, status=status.HTTP_201_CREATED)


class BatchTransactionsView(APIView):
    """
    Returns transactions + totals for a given batch_id:
    {
      "transactions": [...],
      "total_credit": 123.45,
      "total_debit": 67.89,
      "final_balance": 456.78
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        batch_id = request.query_params.get("batch_id")
        if not batch_id:
            return Response({"detail": "batch_id is required"}, status=400)

        qs = (BankTransaction.objects
              .filter(upload_batch_id=batch_id)
              .order_by("-transaction_date", "-created_at"))

        txns = BankTransactionSerializer(qs, many=True).data

        aggs = qs.aggregate(total_credit=Sum("credit_amount"), total_debit=Sum("debit_amount"))
        total_credit = aggs["total_credit"] or Decimal("0")
        total_debit = aggs["total_debit"] or Decimal("0")

        last_tx = qs.order_by("transaction_date", "created_at").last()
        final_balance = last_tx.balance_amount if last_tx else Decimal("0")

        return Response(
            {
                "transactions": txns,
                "total_credit": total_credit,
                "total_debit": total_debit,
                "final_balance": final_balance,
            },
            status=200,
        )


class RecentUploadsView(APIView):
    """
    Returns latest batches for a bank account:
    { "recent_uploads": [ {batch_id, upload_date, file_name, uploaded_by, transactions_uploaded, status}, ... ] }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        bank_account_id = request.query_params.get("bank_account_id")
        if not bank_account_id:
            return Response({"detail": "bank_account_id is required"}, status=400)

        qs = (BankUploadBatch.objects
              .filter(bank_account_id=bank_account_id)
              .order_by("-created_at")[:10])

        rows = []
        for b in qs:
            status_txt = "Passed" if (
                b.balance_continuity_in_file
                and b.previous_ending_balance_match
                and b.errors_count == 0
            ) else "Needs Review"
            rows.append({
                "batch_id": str(b.id),
                "upload_date": b.created_at.strftime("%Y-%m-%d %H:%M"),
                "file_name": b.file_name,
                "uploaded_by": getattr(b.uploaded_by, "get_full_name", lambda: None)() or getattr(b.uploaded_by, "username", None) or "-",
                "transactions_uploaded": b.uploaded_count,
                "status": status_txt,
            })

        return Response({"recent_uploads": rows}, status=200)
