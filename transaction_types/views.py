# transaction_types/views.py
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied

from .models import TransactionType
from .serializers import TransactionTypeSerializer

# Matrix-based guard
from users.permissions_matrix_guard import RoleActionPermission


def is_super(user) -> bool:
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"


# Bind the guard for this module with explicit HTTP→logical action map
PermTxnTypes = RoleActionPermission.bind(
    module="transaction_types",
    action_map={
        "GET": "list",
        "POST": "create",
        "PUT": "update",
        "PATCH": "update",
        "DELETE": "delete",
    },
)


# --- helpers to make search/order safe even if fields differ ---
def _field_exists(model, name: str) -> bool:
    return any(getattr(f, "name", None) == name for f in model._meta.get_fields())


class TransactionTypeViewSet(viewsets.ModelViewSet):
    """
    CRUD for TransactionType.

    - Read: roles per MATRIX["transaction_types"]["list"/"view"].
    - Create/Update/Delete: enforced by matrix (typically SUPER_USER only).
    - Non-super users are scoped to their assigned companies (read & write).
    - DELETE is a soft delete by setting status='Inactive'.
    """
    serializer_class = TransactionTypeSerializer
    permission_classes = [IsAuthenticated, PermTxnTypes]

    queryset = TransactionType.objects.select_related("company").all()

    # Basic server-side filtering + search + ordering (robust)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["company", "direction", "status"]

    def get_search_fields(self):
        fields = []
        for cand in ("name", "code", "description"):
            if _field_exists(TransactionType, cand):
                fields.append(cand)
        return fields

    def get_ordering_fields(self):
        fields = {"id"}  # always present
        for cand in ("name", "direction", "status", "created_at", "created_on"):
            if _field_exists(TransactionType, cand):
                fields.add(cand)
        return list(fields)

    def get_ordering(self):
        for cand in ("-created_at", "-created_on", "-id"):
            base = cand[1:] if cand.startswith("-") else cand
            if _field_exists(TransactionType, base):
                return [cand]
        return ["-id"]

    # ----- read scoping -----
    def get_queryset(self):
        user = self.request.user
        qs = self.queryset

        if is_super(user):
            # Optional super narrowing: ?company=<id>
            company_id = self.request.query_params.get("company")
            if company_id:
                try:
                    qs = qs.filter(company_id=int(company_id))
                except ValueError:
                    qs = qs.none()
            return qs.order_by(*self.get_ordering())

        companies_rel = getattr(user, "companies", None)
        if not companies_rel or not companies_rel.exists():
            return qs.none()

        return qs.filter(company__in=companies_rel.all()).order_by(*self.get_ordering())

    # ----- write scoping -----
    def _assert_company_allowed(self, user, company):
        if is_super(user) or company is None:
            return
        companies_rel = getattr(user, "companies", None)
        if not companies_rel or company not in companies_rel.all():
            raise PermissionDenied("You are not allowed to use this company.")

    def perform_create(self, serializer):
        """
        Non-super:
          - If company provided, it must be one of user's companies.
          - If not provided and user has exactly one company → auto-assign.
          - If multiple companies and none provided → 400.
        Super: can create for any company.
        """
        user = self.request.user
        company = serializer.validated_data.get("company")

        if is_super(user):
            serializer.save()
            return

        companies_rel = getattr(user, "companies", None)
        if not companies_rel or not companies_rel.exists():
            raise ValidationError({"company": ["You are not linked to any company."]})

        if company:
            self._assert_company_allowed(user, company)
            serializer.save()
            return

        if companies_rel.count() == 1:
            serializer.save(company=companies_rel.first())
        else:
            raise ValidationError({"company": ["Please specify a company (you belong to multiple companies)."]})

    def perform_update(self, serializer):
        """
        Guard against moving records to companies the user doesn't belong to.
        """
        user = self.request.user
        instance = self.get_object()
        target_company = serializer.validated_data.get("company", getattr(instance, "company", None))
        self._assert_company_allowed(user, target_company)
        serializer.save()

    # ----- soft delete -----
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Extra safety: ensure user may touch this company
        self._assert_company_allowed(request.user, getattr(instance, "company", None))
        if _field_exists(TransactionType, "status"):
            instance.status = "Inactive"
            instance.save(update_fields=["status"])
            return Response({"detail": "Transaction Type soft-deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
        # Hard delete fallback if model has no 'status'
        return super().destroy(request, *args, **kwargs)
