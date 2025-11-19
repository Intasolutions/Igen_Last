# igen/views.py
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import List

from django.db.models import Sum, Count
from django.http import JsonResponse
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from companies.models import Company
from banks.models import BankAccount
from cost_centres.models import CostCentre
from transaction_types.models import TransactionType
from users.models import User
from projects.models import Project
from assets.models import Asset
from contacts.models import Contact
from vendors.models import Vendor
from properties.models import Property
from users.serializers import UserSerializer
from tx_classify.models import Classification

# Matrix guard
from users.permissions_matrix_guard import RoleActionPermission

logger = logging.getLogger(__name__)


def health(request):
    return JsonResponse({"status": "ok"})


# ------------------ helpers: scoping ------------------
def _scoped_company_ids(request) -> List[int]:
    """
    Resolve the set of company IDs the current user can see.

    Priority order:
    1) Superuser:
       - if ?company=<id> is provided, scope to that single company
       - else: all companies
    2) Non-superuser:
       - aggregate IDs from:
         a) M2M users.companies
         b) legacy FK user.company_id
         c) JWT payload 'company_id' (when present)
       - if ?company=<id> is present, only allow it if included in the visible set
    """
    u = request.user
    is_su = bool(getattr(u, "is_superuser", False))

    # ?company=<id> override (optional)
    qp = None
    try:
        q = request.query_params.get("company")
        if q and str(q).isdigit():
            qp = int(q)
    except Exception:
        pass

    # JWT payload (if using SimpleJWT + custom claims)
    token_company_id = None
    try:
        payload = getattr(getattr(request, "auth", None), "payload", None)
        if isinstance(payload, dict) and payload.get("company_id"):
            token_company_id = int(payload["company_id"])
    except Exception:
        pass

    # M2M preferred
    m2m_ids: List[int] = []
    try:
        if hasattr(u, "companies"):
            m2m_ids = list(u.companies.values_list("id", flat=True))
    except Exception:
        pass

    # Legacy FK fallback
    legacy_fk = getattr(u, "company_id", None)
    legacy_ids: List[int] = [legacy_fk] if legacy_fk else []

    if is_su:
        if qp:
            return [qp]
        return list(Company.objects.values_list("id", flat=True))

    visible = set(m2m_ids or legacy_ids)
    if token_company_id:
        visible.add(token_company_id)

    if qp:
        # Only allow explicit query param if it's within the user's visible set
        return [qp] if qp in visible else []

    return list(visible)


def _scoped_count(model, company_ids: List[int], is_su: bool) -> int:
    """
    Count model instances with company scoping when possible.
    Tries several common FK paths and uses the first that works.
    """
    qs = model.objects.all()
    if is_su:
        return qs.count()
    if not company_ids:
        return 0

    for fp in (
        "company_id__in",
        "company__id__in",
        "company__in",
        "property__company_id__in",
        "project__company_id__in",
        "entity__company_id__in",
    ):
        try:
            return qs.filter(**{fp: company_ids}).distinct().count()
        except Exception:
            continue
    return 0


@api_view(["GET"])
@permission_classes([IsAuthenticated, RoleActionPermission.for_module("dashboard_stats")])
def dashboard_stats(request):
    """
    Dashboard summary (counts + 30-day classification trend + simple financials),
    scoped by company for non-superusers.
    """
    u = request.user
    is_su = bool(getattr(u, "is_superuser", False))
    company_ids = _scoped_company_ids(request)

    # ---- Totals (scoped) ----
    if is_su:
        total_users = User.objects.count()
        total_companies = Company.objects.count()
    else:
        # Users: count only those attached to the same visible companies
        total_users = (
            User.objects.filter(companies__id__in=company_ids).distinct().count()
            if company_ids else 0
        )
        total_companies = Company.objects.filter(id__in=company_ids).count() if company_ids else 0

    total_projects = _scoped_count(Project, company_ids, is_su)
    total_properties = _scoped_count(Property, company_ids, is_su)
    total_assets = _scoped_count(Asset, company_ids, is_su)
    total_contacts = _scoped_count(Contact, company_ids, is_su)
    total_cost_centres = _scoped_count(CostCentre, company_ids, is_su)
    total_banks = _scoped_count(BankAccount, company_ids, is_su)
    total_vendors = _scoped_count(Vendor, company_ids, is_su)
    total_transaction_types = _scoped_count(TransactionType, company_ids, is_su)

    # ---- Trend: last 30 days (TZ-aware) ----
    end_date = timezone.now().date()
    start_date = end_date - timedelta(days=30)
    start_dt = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
    end_dt = timezone.make_aware(datetime.combine(end_date, datetime.max.time()))

    cls = Classification.objects.filter(created_at__gte=start_dt, created_at__lte=end_dt)
    if not is_su and company_ids:
        for fp in (
            "company_id__in",
            "property__company_id__in",
            "project__company_id__in",
            "entity__company_id__in",
        ):
            try:
                cls = cls.filter(**{fp: company_ids})
                break
            except Exception:
                continue

    raw = (
        cls.values("created_at__date")
        .annotate(classified_count=Count("classification_id"))
        .order_by("created_at__date")
    )
    all_dates = [start_date + timedelta(days=i) for i in range(31)]
    raw_map = {row["created_at__date"]: row["classified_count"] for row in raw}
    trend_data = [{"date": d.strftime("%Y-%m-%d"), "classified_count": raw_map.get(d, 0)} for d in all_dates]

    # ---- Financials (very simple) ----
    rev_qs = Classification.objects.filter(amount__gt=0, created_at__gte=start_dt, created_at__lte=end_dt)
    exp_qs = Classification.objects.filter(amount__lt=0, created_at__gte=start_dt, created_at__lte=end_dt)
    if not is_su and company_ids:
        for fp in (
            "company_id__in",
            "property__company_id__in",
            "project__company_id__in",
            "entity__company_id__in",
        ):
            try:
                rev_qs = rev_qs.filter(**{fp: company_ids})
                exp_qs = exp_qs.filter(**{fp: company_ids})
                break
            except Exception:
                continue

    total_revenue = rev_qs.aggregate(total=Sum("amount"))["total"] or 0
    total_expenses = exp_qs.aggregate(total=Sum("amount"))["total"] or 0
    total_expenses = abs(total_expenses)

    # Simple static budget placeholder
    budget = 1_000_000
    budget_utilization = (total_expenses / budget * 100) if budget else 0

    return Response(
        {
            "total_users": total_users,
            "total_companies": total_companies,
            "total_projects": total_projects,
            "total_properties": total_properties,
            "total_assets": total_assets,
            "total_contacts": total_contacts,
            "total_cost_centres": total_cost_centres,
            "total_banks": total_banks,
            "total_vendors": total_vendors,
            "total_transaction_types": total_transaction_types,
            "trend_data": trend_data,
            "total_revenue": float(total_revenue),
            "total_expenses": float(total_expenses),
            "budget_utilization": round(float(budget_utilization), 1),
        }
    )


# -------- analytics helpers (kept simple) --------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def spend_by_cost_centre(request):
    """
    Note: If you later add a direct FK from CostCentre to Company,
    update this to filter by _scoped_company_ids similar to dashboard_stats.
    """
    try:
        spend = CostCentre.objects.annotate(total=Sum("classifications__amount")).values("name", "total")
    except Exception:
        spend = CostCentre.objects.annotate(total=Sum("classification__amount")).values("name", "total")

    data = [{"cost_centre": r["name"], "total": abs(float(r["total"] or 0.0))} for r in spend]
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def top_vendors_by_spend(request):
    return Response(
        {"message": "Vendor spend data not available due to missing relationship"},
        status=status.HTTP_200_OK,
    )


# -------- simple user admin (unchanged) --------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_list(request):
    users = User.objects.all()
    return Response(UserSerializer(users, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_user(request):
    data = request.data.copy()
    password = data.pop("password", None)

    ser = UserSerializer(data=data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    user = ser.save()
    if password:
        user.set_password(password)
        user.save()

    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_user(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    user.delete()
    return Response({"message": "User deleted"})
