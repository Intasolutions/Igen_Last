from django.core.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated

from .models import BankAccount
from .serializers import BankAccountSerializer
from users.permissions_matrix_guard import RoleActionPermission

PermBanks = RoleActionPermission.for_module("banks")


def is_super(user) -> bool:
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"


class BankAccountViewSet(viewsets.ModelViewSet):
    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated, PermBanks]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {"company": ["exact"], "is_active": ["exact"]}
    search_fields = ["account_name", "account_number", "bank_name", "ifsc"]
    ordering_fields = ["created_at", "account_name"]
    ordering = ["-created_at"]

    def get_queryset(self):
        """
        Non-super users see only banks for their assigned companies.
        SUPER_USER can see everything.
        `include_inactive` controls active/inactive filtering.
        """
        qs = BankAccount.objects.select_related("company")
        include_inactive = (self.request.query_params.get("include_inactive") or "").lower()

        user = self.request.user
        if not is_super(user):
            rel = getattr(user, "companies", None)
            if not rel or not rel.exists():
                return BankAccount.objects.none()
            qs = qs.filter(company__in=rel.all())

        return qs if include_inactive in {"1", "true", "yes", "on"} else qs.filter(is_active=True)

    def perform_create(self, serializer):
        """
        SUPER_USER: must specify company.
        Non-super: can only create for one of their assigned companies.
        If the user has exactly one company and none is provided, auto-assign it.
        """
        user = self.request.user
        company = serializer.validated_data.get("company")

        if is_super(user):
            if not company:
                raise PermissionDenied("SUPER_USER must specify company.")
            serializer.save()
            return

        rel = getattr(user, "companies", None)
        if not rel or not rel.exists():
            raise PermissionDenied("User is not linked to any company.")

        if company and not rel.filter(pk=company.pk).exists():
            raise PermissionDenied("You cannot create accounts for this company.")

        if company:
            serializer.save()
        elif rel.count() == 1:
            serializer.save(company=rel.first())
        else:
            raise PermissionDenied("Please select a company.")

    def perform_update(self, serializer):
        """
        SUPER_USER: unrestricted.
        Non-super: can only update records where the company remains within their assigned companies.
        Also prevents moving a record to a company the user doesn't belong to.
        """
        user = self.request.user
        instance = self.get_object()
        new_company = serializer.validated_data.get("company", instance.company)

        if is_super(user):
            serializer.save()
            return

        rel = getattr(user, "companies", None)
        if not rel or not rel.exists():
            raise PermissionDenied("User is not linked to any company.")

        if not rel.filter(pk=new_company.pk).exists():
            raise PermissionDenied("You cannot modify accounts for this company.")

        serializer.save()
