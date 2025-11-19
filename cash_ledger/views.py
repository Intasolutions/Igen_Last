from django.db import transaction
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, permissions, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.http import HttpResponse
import csv

from .models import CashLedgerRegister
from .serializers import CashLedgerRegisterSerializer

# Role-matrix guard
from users.permissions_matrix_guard import RoleActionPermission


def is_super(user):
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"


# Bind per-module permission (HTTP -> logical action)
PermCash = RoleActionPermission.bind(
    module="cash_ledger",
    action_map={
        "GET": "list",
        "POST": "create",
        "PUT": "update",
        "PATCH": "update",
        "DELETE": "delete",
    },
)


class CashLedgerRegisterViewSet(viewsets.ModelViewSet):
    serializer_class = CashLedgerRegisterSerializer
    permission_classes = [permissions.IsAuthenticated, PermCash]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        "company",
        "cost_centre",
        "entity",
        "transaction_type",
        "spent_by",
        "chargeable",
        "is_active",
        "date",
    ]
    search_fields = ["remarks"]
    ordering_fields = ["date", "amount", "id"]
    ordering = ["-date", "-id"]

    def get_queryset(self):
        user = self.request.user

        # Base queryset with helpful select_related for performance
        qs = (
            CashLedgerRegister.objects.select_related(
                "company",
                "cost_centre",
                "entity",
                "transaction_type",
                "spent_by",
                "asset",
                "contract",
            )
            .all()
            .order_by(*self.ordering)
        )

        # Scope by company
        if is_super(user):
            # Optional narrowing by ?company=<id>
            company_id = self.request.query_params.get("company")
            if company_id:
                qs = qs.filter(company_id=company_id)
        else:
            companies_rel = getattr(user, "companies", None)
            if not companies_rel:
                return qs.none()
            qs = qs.filter(company__in=companies_rel.all())

        # Default to active-only unless explicitly asked otherwise
        include_inactive = (self.request.query_params.get("include_inactive") or "").lower() in (
            "1",
            "true",
            "yes",
        )
        explicit_is_active = "is_active" in self.request.query_params  # let filterset handle if given

        if not include_inactive and not explicit_is_active:
            qs = qs.filter(is_active=True)

        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    @transaction.atomic
    def perform_create(self, serializer):
        """
        - SUPER_USER: must provide company in payload.
        - Non-super: company must be one they belong to.
          If user has exactly one company and company is missing, auto-fill.
        - Computes running balance based on last active entry in that company.
        """
        user = self.request.user

        provided_company = serializer.validated_data.get("company")

        if is_super(user):
            if not provided_company:
                raise serializers.ValidationError("Super User must specify company explicitly.")
            company = provided_company
        else:
            companies_rel = getattr(user, "companies", None)
            if not companies_rel or not companies_rel.exists():
                raise serializers.ValidationError("User is not linked to any company.")

            if provided_company:
                if provided_company not in companies_rel.all():
                    raise PermissionDenied("You cannot create entries for this company.")
                company = provided_company
            else:
                # If one company, auto-pick; else require explicit company
                count = companies_rel.count()
                if count == 1:
                    company = companies_rel.first()
                else:
                    raise serializers.ValidationError(
                        "Please specify company (you belong to multiple companies)."
                    )

        last_entry = (
            CashLedgerRegister.objects.filter(company=company, is_active=True)
            .order_by("-date", "-id")
            .first()
        )
        previous_balance = last_entry.balance_amount if last_entry else 0

        amount = serializer.validated_data["amount"]
        chargeable = serializer.validated_data.get("chargeable", False)
        margin = serializer.validated_data.get("margin") or 0

        effective_amount = amount - margin if chargeable and margin else amount
        new_balance = previous_balance - effective_amount

        serializer.save(
            created_by=user,
            company=company,
            balance_amount=new_balance,
            is_active=True,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        """
        Enforce company scoping on update.
        If company changes, user must have access.
        Running balance is NOT retro-recomputed (keeps behavior consistent with your current design).
        """
        user = self.request.user
        instance = self.get_object()

        target_company = serializer.validated_data.get("company", instance.company)
        if not is_super(user):
            companies_rel = getattr(user, "companies", None)
            if not companies_rel or target_company not in companies_rel.all():
                raise PermissionDenied("You cannot move/update entries to a company you don't belong to.")

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete (deactivate) a cash ledger entry.
        Note: subsequent balances are NOT recomputed (matches current approach).
        """
        entry = self.get_object()
        entry.is_active = False
        entry.save(update_fields=["is_active"])
        return Response({"detail": "Entry deactivated successfully."}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="balance")
    def get_current_balance(self, request):
        """
        Latest active entry balance.
        - SUPER_USER: optional ?company=<id> to scope; otherwise across all companies.
        - Non-super: scoped to their companies; if they belong to multiple, we take
          the latest across those companies (you can refine if you want per-company balances).
        """
        user = request.user

        if is_super(user):
            qs = CashLedgerRegister.objects.filter(is_active=True)
            company_id = request.query_params.get("company")
            if company_id:
                qs = qs.filter(company_id=company_id)
            last_entry = qs.order_by("-date", "-id").first()
        else:
            companies_rel = getattr(user, "companies", None)
            if not companies_rel or not companies_rel.exists():
                return Response({"current_balance": 0})
            last_entry = (
                CashLedgerRegister.objects.filter(company__in=companies_rel.all(), is_active=True)
                .order_by("-date", "-id")
                .first()
            )

        balance = last_entry.balance_amount if last_entry else 0
        return Response({"current_balance": balance})

    @action(detail=False, methods=["get"], url_path="export")
    def export_to_csv(self, request):
        """
        Exports the (already filtered) queryset to CSV.
        Respects company scoping, search, filters, etc.
        """
        queryset = self.filter_queryset(self.get_queryset())
        if not queryset.exists():
            return Response({"detail": "No data to export."}, status=status.HTTP_204_NO_CONTENT)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="cash_ledger_export.csv"'

        writer = csv.writer(response)
        writer.writerow(
            [
                "Date",
                "Spent By",
                "Cost Centre",
                "Entity",
                "Transaction Type",
                "Amount",
                "Chargeable",
                "Margin",
                "Balance",
                "Remarks",
            ]
        )

        for obj in queryset.iterator():
            writer.writerow(
                [
                    obj.date,
                    obj.spent_by.full_name if obj.spent_by else "",
                    obj.cost_centre.name if obj.cost_centre else "",
                    obj.entity.name if obj.entity else "",
                    obj.transaction_type.name if obj.transaction_type else "",
                    obj.amount,
                    "Yes" if obj.chargeable else "No",
                    obj.margin or "",
                    obj.balance_amount,
                    obj.remarks or "",
                ]
            )

        return response
