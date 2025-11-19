# receipts/views.py
from django.core.exceptions import PermissionDenied
from django.db import transaction

from rest_framework import viewsets, filters, serializers
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Receipt
from .serializers import ReceiptSerializer

# role-matrix guard
from users.permissions_matrix_guard import RoleActionPermission


def is_super(user):
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"


# Prefer modern helper; (.bind) also works due to shim
PermReceipts = RoleActionPermission.for_module(
    module="receipts",
)


class ReceiptViewSet(viewsets.ModelViewSet):
    """
    Receipts are scoped by company:
      - SUPER_USER: can access all; may narrow with ?company=<id>.
      - Non-super: only receipts for companies they are assigned to.
    Uploads supported via multipart/form-data (document field).
    """
    serializer_class = ReceiptSerializer
    permission_classes = [IsAuthenticated, PermReceipts]
    parser_classes = [MultiPartParser, FormParser]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        "company",
        "entity",
        "bank",
        "transaction_type",
        "cost_centre",
        "gst_applicable",
        "date",
    ]
    search_fields = ["reference", "notes"]
    ordering_fields = ["date", "amount", "id"]
    ordering = ["-date", "-id"]

    def get_queryset(self):
        user = self.request.user

        qs = (
            Receipt.objects.select_related(
                "company",
                "entity",
                "bank",
                "transaction_type",
                "cost_centre",
            )
            .all()
            .order_by(*self.ordering)
        )

        if is_super(user):
            company_id = self.request.query_params.get("company")
            if company_id:
                qs = qs.filter(company_id=company_id)
            return qs

        companies_rel = getattr(user, "companies", None)
        if not companies_rel or not companies_rel.all().exists():
            return qs.none()

        return qs.filter(company__in=companies_rel.all())

    @transaction.atomic
    def perform_create(self, serializer):
        """
        SUPER_USER: must provide company explicitly.
        Non-super:
          - If company provided, it must be one of user's companies.
          - If not provided and user has exactly one company → auto-assign.
          - If multiple companies and none provided → 400.
        """
        user = self.request.user
        provided_company = serializer.validated_data.get("company")

        if is_super(user):
            if not provided_company:
                raise serializers.ValidationError("Super User must specify company explicitly.")
            company = provided_company
        else:
            companies_rel = getattr(user, "companies", None)
            if not companies_rel or not companies_rel.all().exists():
                raise serializers.ValidationError("User is not linked to any company.")

            if provided_company:
                if not companies_rel.filter(pk=provided_company.pk).exists():
                    raise PermissionDenied("You cannot create receipts for this company.")
                company = provided_company
            else:
                count = companies_rel.count()
                if count == 1:
                    company = companies_rel.first()
                else:
                    raise serializers.ValidationError(
                        "Please specify company (you belong to multiple companies)."
                    )

        serializer.save(company=company)

    @transaction.atomic
    def perform_update(self, serializer):
        """
        Enforce company scoping on update as well.
        """
        user = self.request.user
        instance = self.get_object()
        target_company = serializer.validated_data.get("company", instance.company)

        if not is_super(user):
            companies_rel = getattr(user, "companies", None)
            if not companies_rel or not companies_rel.filter(pk=target_company.pk).exists():
                raise PermissionDenied("You cannot move/update receipts to a company you don't belong to.")

        serializer.save()
