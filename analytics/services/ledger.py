# analytics/services/ledger.py
from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable, List, Dict, Optional, Iterable as _Iterable

from django.apps import apps
from django.conf import settings
from django.db.models import Q, DateField, DateTimeField
from django.utils.timezone import make_naive


# ---------- tiny utils ----------
def _dec(x) -> Decimal:
    try:
        return Decimal(x or 0)
    except Exception:
        return Decimal("0")


def _to_date(d):
    if d is None:
        return None
    if hasattr(d, "date"):
        return make_naive(d).date() if getattr(d, "tzinfo", None) else d.date()
    return d


def _fields(model) -> set:
    return {f.name for f in model._meta.get_fields()}


def _get_models(app_label: str) -> List[type]:
    try:
        return list(apps.get_app_config(app_label).get_models())
    except Exception:
        return []


def _pick_date_field(
    Model,
    candidates=("value_date", "transaction_date", "date", "posting_date", "book_date"),
) -> Optional[str]:
    """
    Try to pick a sensible date field from the model.

    1) Prefer common names like value_date, transaction_date, etc.
    2) If none match, fall back to the first DateField / DateTimeField on the model.
    """
    fs = _fields(Model)

    # 1) Try standard field names
    for c in candidates:
        if c in fs:
            return c

    # 2) Fallback: first DateField / DateTimeField
    for f in Model._meta.get_fields():
        if isinstance(f, (DateField, DateTimeField)):
            return f.name

    # 3) Nothing reasonable found
    return None


def _has_fk(Model, base: str) -> bool:
    fs = _fields(Model)
    return base in fs or f"{base}_id" in fs


def _filter_fk(qs, Model, base: str, value):
    if value is None:
        return qs
    fs = _fields(Model)
    if f"{base}_id" in fs:
        return qs.filter(**{f"{base}_id": value})
    if base in fs:
        return qs.filter(**{f"{base}__id": value})
    return qs


def _get_field(Model, name: str):
    try:
        return Model._meta.get_field(name)
    except Exception:
        return None


def _is_rel(Model, field_name: str) -> bool:
    f = _get_field(Model, field_name)
    return bool(
        f and getattr(f, "is_relation", False) and getattr(f, "related_model", None)
    )


def _related_has(Model, base: str, subfield: str) -> bool:
    """
    True if Model.<base> is a relation and the related model actually has <subfield>.
    """
    f = _get_field(Model, base)
    if not f or not getattr(f, "is_relation", False) or not getattr(
        f, "related_model", None
    ):
        return False
    try:
        f.related_model._meta.get_field(subfield)
        return True
    except Exception:
        return False


def _scope_by_user(qs, Model, user):
    """
    Basic scoping: if the model has a `company` FK and the user is not SUPER_USER,
    filter by user's companies (if available).
    """
    fs = _fields(Model)
    if "company" in fs or "company_id" in fs:
        role = getattr(user, "role", None)
        if role != "SUPER_USER":
            companies_rel = getattr(user, "companies", None)
            if companies_rel is not None:
                try:
                    return qs.filter(company__in=companies_rel.all())
                except Exception:
                    # If companies is not a manager or anything odd, keep conservative (no filter)
                    return qs
    return qs


# ---------- labels / amounts ----------
def _txn_type_label(obj) -> Optional[str]:
    t = getattr(obj, "transaction_type", None)
    name = getattr(t, "name", None)
    if name:
        return name
    for attr in ("transaction_type", "txn_type", "type", "category"):
        v = getattr(obj, attr, None)
        if v:
            return str(v)
    return None


def _resolve_amount_pair(obj) -> Dict[str, Decimal]:
    """
    Normalize to {credit,debit} across common schemas.
    Priority:
      1) Explicit pairs: (credit, debit) or (credit_amount, debit_amount)
      2) (deposit, withdrawal)
      3) signed_amount
      4) amount/value (+ direction field, type name, or sign)
    """
    # 1) credit/debit exact field names
    if hasattr(obj, "credit") or hasattr(obj, "debit"):
        return {
            "credit": _dec(getattr(obj, "credit", 0)),
            "debit": _dec(getattr(obj, "debit", 0)),
        }

    # common bank field names
    if hasattr(obj, "credit_amount") or hasattr(obj, "debit_amount"):
        return {
            "credit": _dec(getattr(obj, "credit_amount", 0)),
            "debit": _dec(getattr(obj, "debit_amount", 0)),
        }

    # 2) deposit/withdrawal
    if hasattr(obj, "deposit") or hasattr(obj, "withdrawal"):
        return {
            "credit": _dec(getattr(obj, "deposit", 0)),
            "debit": _dec(getattr(obj, "withdrawal", 0)),
        }

    # 3) signed_amount
    if hasattr(obj, "signed_amount"):
        sa = _dec(getattr(obj, "signed_amount"))
        return {
            "credit": sa if sa >= 0 else Decimal("0"),
            "debit": abs(sa) if sa < 0 else Decimal("0"),
        }

    # 4) amount/value (+ optional directional hint)
    amt = None
    for a in ("amount", "value", "txn_amount", "transaction_amount"):
        if hasattr(obj, a):
            amt = _dec(getattr(obj, a))
            break

    if amt is not None:
        # 4a) explicit boolean flags is_credit / is_debit
        if hasattr(obj, "is_credit") or hasattr(obj, "is_debit"):
            is_credit = bool(getattr(obj, "is_credit", False))
            is_debit = bool(getattr(obj, "is_debit", False))
            # if exactly one of them is true, trust it
            if is_credit and not is_debit:
                return {"credit": amt, "debit": Decimal("0")}
            if is_debit and not is_credit:
                return {"credit": Decimal("0"), "debit": amt}
            # if both False or conflicting, fall through to other hints

        # 4b) direction fields: CR / DR / CREDIT / DEBIT etc.
        # Also treat longer labels that *contain* "credit" / "debit"
        for k in (
            "cr_dr",
            "dr_cr",
            "type",
            "direction",
            "txn_dir",
            "transaction_type",
            "txn_type",
            "entry_type",
            "entry_side",
            "dr_cr_flag",
        ):
            if not hasattr(obj, k):
                continue
            raw = getattr(obj, k)
            if raw is None:
                continue
            # If it's a related object with a code/name, try those; else use str(...).
            val = getattr(raw, "code", None) or getattr(raw, "name", None) or str(raw)
            val = str(val or "").strip().lower()
            if not val:
                continue

            # explicit short codes or words
            if val in ("cr", "c") or "credit" in val:
                return {"credit": amt, "debit": Decimal("0")}
            if val in ("dr", "d") or "debit" in val:
                return {"credit": Decimal("0"), "debit": amt}

        # 4c) transaction_type NAME heuristics (client specific)
        # Try to derive a clean text name even if transaction_type is a related object
        ttype_name = ""
        t = getattr(obj, "transaction_type", None)
        if t is not None:
            ttype_name = str(getattr(t, "name", "") or str(t)).strip().lower()
        if not ttype_name:
            ttype_name = str(getattr(obj, "txn_type", "") or "").strip().lower()

        if ttype_name:
            # Treat these as DEBITS (outgoing from entity)
            DEBIT_KEYWORDS = (
                "paid",
                "payment",
                "payout",
                "to landlord",
                "rent out",
                "landlord payout",
                "rent paid",
                "refund paid",
                "withdraw",
                "withdrawal",
                # generic expense words
                "expense",
                "expenses",
                "maint",
                "maintenance",
                "interior",
                "m & i",
                "repair",
                "repairs",
                "service charge",
                "bank charge",
                "bank charges",
                "charge",
                "charges",
                "fee",
                "fees",
                "commission",
                "interest paid",
                "penalty",
                "fine",
                "salary",
                "wages",
                "tds",
                "tax",
                "gst",
            )
            # Treat these as CREDITS (incoming to entity)
            CREDIT_KEYWORDS = (
                "rent in",
                "rent received",
                "token received",
                "token",
                "received",
                "receipt",
                "inflow",
                "deposit",
                "advance received",
                "refund received",
            )

            if any(k in ttype_name for k in DEBIT_KEYWORDS):
                return {"credit": Decimal("0"), "debit": amt}
            if any(k in ttype_name for k in CREDIT_KEYWORDS):
                return {"credit": amt, "debit": Decimal("0")}

        # 4d) sign fallback (if we have no direction at all)
        return (
            {"credit": amt, "debit": Decimal("0")}
            if amt >= 0
            else {"credit": Decimal("0"), "debit": abs(amt)}
        )

    # no recognizable amount
    return {"credit": Decimal("0"), "debit": Decimal("0")}


def _map_common(obj) -> Dict:
    """
    Map common dimension fields (entity, cost centre, contract, asset, project)
    and support both FK relations AND plain text fields.

    This is where we also ensure a text **project name** is available,
    which the Project Profitability report uses.
    """
    ent = getattr(obj, "entity", None)
    cc = getattr(obj, "cost_centre", None)
    con = getattr(obj, "contract", None)
    asst = getattr(obj, "asset", None)
    proj = getattr(obj, "project", None)

    # ---- helper to get a human name ----
    def _name_from(rel, extra_attr: Optional[str] = None):
        if rel is None:
            return None
        # FK / object-like
        for attr in ("name", "full_name", "code", extra_attr):
            if not attr:
                continue
            if hasattr(rel, attr):
                v = getattr(rel, attr)
                if v:
                    return str(v)
        # Plain text / other object
        if isinstance(rel, (int, float, Decimal)):
            return None
        return str(rel)

    # base names
    entity_name = _name_from(ent)
    cost_centre_name = _name_from(cc)
    contract_name = _name_from(con, "vendor_name")
    asset_name = _name_from(asst)

    # entity_type from Entity model (Property / Project / Contact / Internal)
    entity_type = None
    if ent is not None:
        entity_type = (
            getattr(ent, "entity_type", None)
            or getattr(ent, "type", None)
            or getattr(ent, "category", None)
        )

    # project object that might come from the entity
    project_obj_from_entity = None
    if ent is not None and isinstance(entity_type, str):
        etype = entity_type.lower()
        if etype.startswith("project"):
            # prefer linked_project if present, otherwise treat entity itself as project
            project_obj_from_entity = getattr(ent, "linked_project", None) or ent

    # ---- project name resolution ----
    # 1) direct project FK on the object (if any)
    project_name = _name_from(proj)

    # 2) explicit project_name column on the object
    if not project_name and hasattr(obj, "project_name"):
        project_name = getattr(obj, "project_name") or None

    # 3) derive from entity when entity represents a project
    if not project_name and project_obj_from_entity is not None:
        project_name = _name_from(project_obj_from_entity)

    names = {
        "entity": entity_name,
        "cost_centre": cost_centre_name,
        "contract": contract_name,
        "asset": asset_name,
        "project": project_name,
    }

    # Also expose project_name explicitly if present on model –
    # useful for some front-ends / reports that look for this key.
    if hasattr(obj, "project_name"):
        names["project_name"] = getattr(obj, "project_name") or project_name

    # ---- IDs ----
    project_id = getattr(obj, "project_id", None) or getattr(proj, "id", None)
    if not project_id and project_obj_from_entity is not None:
        project_id = getattr(project_obj_from_entity, "id", None)

    ids = {
        "entity_id": getattr(obj, "entity_id", None) or getattr(ent, "id", None),
        "cost_centre_id": getattr(obj, "cost_centre_id", None) or getattr(cc, "id", None),
        "contract_id": getattr(obj, "contract_id", None) or getattr(con, "id", None),
        "asset_id": getattr(obj, "asset_id", None) or getattr(asst, "id", None),
        "project_id": project_id,
    }

    remarks = (
        getattr(obj, "remarks", None)
        or getattr(obj, "description", None)
        or getattr(obj, "narration", None)
    )

    # include entity_type so reports can filter on it
    return {**names, **ids, "entity_type": entity_type, "remarks": remarks}


def _map_with_date_and_amount(obj, date_field: str) -> Optional[Dict]:
    try:
        out = _map_common(obj)
        out["txn_type"] = _txn_type_label(obj)
        out["value_date"] = _to_date(getattr(obj, date_field, None))
        out.update(_resolve_amount_pair(obj))
        return out if out["value_date"] else None
    except Exception:
        return None


# ---------- model pickers ----------
def _smart_pick_model(app_label: str, prefer: _Iterable[str]) -> Optional[type]:
    models = _get_models(app_label)
    by_name = {m.__name__: m for m in models}
    for n in prefer:
        if n in by_name:
            return by_name[n]
    best, score = None, -1
    for m in models:
        fs = _fields(m)
        date_ok = any(
            f in fs
            for f in ("value_date", "transaction_date", "date", "posting_date", "book_date")
        )
        amountish = any(
            f in fs
            for f in (
                "credit",
                "debit",
                "amount",
                "value",
                "deposit",
                "withdrawal",
                "signed_amount",
                "credit_amount",
                "debit_amount",
            )
        )
        if date_ok and amountish:
            s = sum(
                1
                for f in ("entity", "cost_centre", "contract", "asset", "project")
                if f in fs or f"{f}_id" in fs
            )
            if s > score:
                best, score = m, s
    return best


# ---------- M&I matchers + filter ----------
def _mi_cc_matchers():
    """
    What counts as 'Maintenance & Interior'.
    Supports either:
      - ANALYTICS_MI_CC_ALIASES = ["maintenance","interior","mi", ...]
      - or legacy ANALYTICS_MI_MATCHERS = {"slugs":[...], "names_icontains":[...], "ids":[...]}
    """
    aliases = getattr(settings, "ANALYTICS_MI_CC_ALIASES", None)
    if aliases:
        slugs = list(aliases)
        names = list(aliases)
        ids = getattr(settings, "ANALYTICS_MI_CC_IDS", []) or []
        return slugs, names, ids

    # Legacy dict fallback
    cfg = getattr(settings, "ANALYTICS_MI_MATCHERS", {}) or {}
    slugs = cfg.get("slugs", ["maintenance", "interior", "mi"])
    names = cfg.get("names_icontains", ["maint", "interior", "m & i", "mi"])
    ids = cfg.get("ids", [])
    return slugs, names, ids


def _mi_ttype_matchers():
    # Controlled via settings.ANALYTICS_MI_TTYPE_ALIASES
    return getattr(
        settings, "ANALYTICS_MI_TTYPE_ALIASES", ["maint", "interior", "m & i", "mi"]
    ) or []


def _apply_mi_filter(q, Model):
    """
    Schema-aware M&I filter:
    - If cost_centre is FK: only use lookups that exist on the related model (slug/name/code).
    - If cost_centre is a plain text field: use icontains/iexact.
    - Also support transaction type name matches (FK or plain).
    - If only cost_centre_id exists, optionally filter by IDs from settings.
    """
    fs = _fields(Model)
    slugs, names, ids = _mi_cc_matchers()
    ttnames = _mi_ttype_matchers()
    cond = Q()

    # cost_centre
    if "cost_centre" in fs:
        if _is_rel(Model, "cost_centre"):
            # relation: add only valid lookups
            if _related_has(Model, "cost_centre", "slug") and slugs:
                cond |= Q(cost_centre__slug__in=slugs)
            if _related_has(Model, "cost_centre", "name") and names:
                for n in names:
                    cond |= Q(cost_centre__name__icontains=n)
            if _related_has(Model, "cost_centre", "code") and slugs:
                cond |= Q(cost_centre__code__in=slugs)
        else:
            # plain text / choice
            terms = set(slugs) | set(names)
            for n in terms:
                cond |= Q(cost_centre__icontains=n) | Q(cost_centre__iexact=n)
    elif "cost_centre_id" in fs:
        if ids:
            cond |= Q(cost_centre_id__in=ids)

    # transaction type
    if ttnames:
        if "transaction_type" in fs:
            if _is_rel(Model, "transaction_type"):
                # try common related names
                if _related_has(Model, "transaction_type", "name"):
                    for n in ttnames:
                        cond |= Q(transaction_type__name__icontains=n)
                if _related_has(Model, "transaction_type", "title"):
                    for n in ttnames:
                        cond |= Q(transaction_type__title__icontains=n)
            else:
                for n in ttnames:
                    cond |= Q(transaction_type__icontains=n)
        if "txn_type" in fs:
            for n in ttnames:
                cond |= Q(txn_type__icontains=n)

    return q.filter(cond) if cond else q


# ---------- property-like FK helper ----------
def _filter_property_like(qs, Model, value):
    """
    Try to apply apartment/property/unit/flat filter using the same ID.
    This lets the caller pass `apartment_id` while different models may
    use slightly different FK names.
    """
    if value is None:
        return qs

    for base in ("apartment", "property", "unit", "flat"):
        if _has_fk(Model, base):
            return _filter_fk(qs, Model, base, value)

    # No matching FK found, leave queryset unchanged
    return qs


# ---------- unified ledger ----------
def unified_ledger(
    user,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    entity_id: Optional[int] = None,
    project_id: Optional[int] = None,
    apartment_id: Optional[int] = None,
    cost_centre_slug: Optional[str] = None,
    only_maint_interior: bool = False,
) -> List[Dict]:
    """
    Merge rows from:
      - tx_classify.*  (preferred)
      - cash_ledger.*  (used only if classification not available)
      - bank_uploads.* (fallback when nothing else)
    """
    rows: List[Dict] = []

    # 1) classified splits — preferred
    SplitModel = _smart_pick_model(
        "tx_classify", ("TransactionSplit", "TxSplit", "Classification")
    )
    used_classify = False
    if SplitModel:
        df = _pick_date_field(SplitModel)
        q = SplitModel.objects.all()
        fset = _fields(SplitModel)

        # include ONLY active rows when the model supports it
        if "is_active_classification" in fset:
            q = q.filter(is_active_classification=True)

        # avoid parents if the schema uses parent/child
        if "is_child" in fset:
            q = q.filter(is_child=True)
        elif "parent" in fset:
            q = q.filter(parent__isnull=False)
        elif "parent_id" in fset:
            q = q.filter(parent_id__isnull=False)

        if df and from_date:
            q = q.filter(**{f"{df}__gte": from_date})
        if df and to_date:
            q = q.filter(**{f"{df}__lte": to_date})

        # scope by user/company when possible
        q = _scope_by_user(q, SplitModel, user)

        if entity_id and _has_fk(SplitModel, "entity"):
            q = _filter_fk(q, SplitModel, "entity", entity_id)
        if project_id and _has_fk(SplitModel, "project"):
            q = _filter_fk(q, SplitModel, "project", project_id)
        if apartment_id:
            q = _filter_property_like(q, SplitModel, apartment_id)

        if cost_centre_slug and ("cost_centre" in fset):
            # only add lookups that exist
            if _related_has(SplitModel, "cost_centre", "slug"):
                q = q.filter(cost_centre__slug=cost_centre_slug)
            elif _related_has(SplitModel, "cost_centre", "name"):
                q = q.filter(cost_centre__name__iexact=cost_centre_slug)

        if only_maint_interior and (
            "cost_centre" in fset
            or "cost_centre_id" in fset
            or "txn_type" in fset
            or "transaction_type" in fset
        ):
            q = _apply_mi_filter(q, SplitModel)

        related = [
            f for f in ("entity", "cost_centre", "contract", "asset", "project") if f in fset
        ]
        before = len(rows)
        for o in q.select_related(*related):
            m = _map_with_date_and_amount(o, df or "value_date")
            if m:
                rows.append(m)
        # Only mark classify as "used" if it actually produced rows
        if len(rows) > before:
            used_classify = True

    # 2) cash ledger — only if we didn't use classification
    if not used_classify:
        CashModel = _smart_pick_model(
            "cash_ledger", ("CashLedger", "Ledger", "LedgerEntry", "CashLedgerRegister")
        )
        if CashModel:
            df = _pick_date_field(CashModel)
            q = CashModel.objects.all()
            fs = _fields(CashModel)

            if df and from_date:
                q = q.filter(**{f"{df}__gte": from_date})
            if df and to_date:
                q = q.filter(**{f"{df}__lte": to_date})

            # scope by user/company
            q = _scope_by_user(q, CashModel, user)

            if entity_id and _has_fk(CashModel, "entity"):
                q = _filter_fk(q, CashModel, "entity", entity_id)
            if project_id and _has_fk(CashModel, "project"):
                q = _filter_fk(q, CashModel, "project", project_id)
            if apartment_id:
                q = _filter_property_like(q, CashModel, apartment_id)

            if cost_centre_slug and "cost_centre" in fs:
                # safely add only existing lookups
                if _related_has(CashModel, "cost_centre", "slug"):
                    q = q.filter(cost_centre__slug=cost_centre_slug)
                elif _related_has(CashModel, "cost_centre", "name"):
                    q = q.filter(cost_centre__name__iexact=cost_centre_slug)

            if only_maint_interior and (
                "cost_centre" in fs
                or "cost_centre_id" in fs
                or "txn_type" in fs
                or "transaction_type" in fs
            ):
                q = _apply_mi_filter(q, CashModel)

            related = [
                f for f in ("entity", "cost_centre", "contract", "asset", "project") if f in fs
            ]
            for o in q.select_related(*related):
                m = _map_with_date_and_amount(o, df or "date")
                if m:
                    rows.append(m)

    # 3) bank uploads — fallback only if classification not used
    #    AND no specific entity/project/apartment filter is requested.
    #    For owner/property statements we do NOT want global bank rows.
    if (
        not used_classify
        and entity_id is None
        and project_id is None
        and apartment_id is None
    ):
        BankModel = _smart_pick_model("bank_uploads", ("BankTransaction",))
        if BankModel:
            df = _pick_date_field(BankModel)
            q = BankModel.objects.all()
            fs = _fields(BankModel)

            if df and from_date:
                q = q.filter(**{f"{df}__gte": from_date})
            if df and to_date:
                q = q.filter(**{f"{df}__lte": to_date})

            # scope by user/company
            q = _scope_by_user(q, BankModel, user)

            if apartment_id:
                q = _filter_property_like(q, BankModel, apartment_id)

            if only_maint_interior:
                q = _apply_mi_filter(q, BankModel)

            related = [
                f for f in ("entity", "cost_centre", "contract", "asset", "project") if f in fs
            ]
            for o in q.select_related(*related):
                m = _map_with_date_and_amount(o, df or "transaction_date")
                if m:
                    rows.append(m)

    rows.sort(
        key=lambda r: (
            r["value_date"],
            r.get("txn_type") or "",
            r.get("remarks") or "",
        )
    )
    return rows


# ---------- balances ----------
def running_balance(
    rows: Iterable[Dict], opening_balance: Decimal = Decimal("0")
) -> List[Dict]:
    bal = opening_balance
    out = []
    for r in rows:
        bal += _dec(r.get("credit", 0)) - _dec(r.get("debit", 0))
        rr = dict(r)
        rr["balance"] = bal
        out.append(rr)
    return out


def opening_balance_until(user, until_exclusive: date, **kwargs) -> Decimal:
    if not until_exclusive:
        return Decimal("0")
    prev_day = until_exclusive - timedelta(days=1)
    rows = unified_ledger(user, to_date=prev_day, **kwargs)
    bal = Decimal("0")
    for r in rows:
        bal += _dec(r.get("credit", 0)) - _dec(r.get("debit", 0))
    return bal


def opening_balance_for_entity_month(user, entity_id: int, month: str) -> Decimal:
    y, m = map(int, month.split("-"))
    start = date(y, m, 1)
    return opening_balance_until(user, start, entity_id=entity_id)
