from django.core.exceptions import PermissionDenied
from django.db.models import Q
from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Entity
from .serializers import EntitySerializer
from users.permissions_matrix_guard import RoleActionPermission

def is_super(user):
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"

# Matrix guard for this module
PermEntities = RoleActionPermission.for_module("entities")

# ----- utilities to stay resilient to model field differences -----
def _has_field(model, name: str) -> bool:
    try:
        return any(getattr(f, "name", None) == name for f in model._meta.get_fields())
    except Exception:
        return False

def _first_exist(model, *candidates: str) -> str | None:
    for c in candidates:
        if c and _has_field(model, c):
            return c
    return None


class EntityViewSet(viewsets.ModelViewSet):
    """
    CRUD for Entity.

    - Non-super users are scoped to their assigned companies.
    - DELETE performs a soft delete by setting status='Inactive' when that field exists.
    """
    serializer_class = EntitySerializer
    permission_classes = [IsAuthenticated, PermEntities]

    # Backends
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    # ⚠️ IMPORTANT: only include fields that actually exist
    # Your model uses `entity_type`, not `type`.
    filterset_fields = [f for f in ["company", "status", "entity_type", "linked_property", "linked_project", "linked_contact"]
                        if _has_field(Entity, f)]

    # These are computed safely at runtime
    search_fields = []          # set in get_search_fields
    ordering_fields = []        # set in get_ordering_fields
    ordering = ["-id"]          # safe fallback; may be overridden in get_ordering

    queryset = (
        Entity.objects
        .select_related("company", "linked_property", "linked_project", "linked_contact")
        .all()
    )

    # ---------- scoping ----------
    def get_queryset(self):
        user = self.request.user
        qs = self.queryset

        if is_super(user):
            return qs

        companies_rel = getattr(user, "companies", None)
        if not companies_rel or not companies_rel.exists():
            return qs.none()

        return qs.filter(company__in=companies_rel.all())

    # ---------- safe dynamic search / ordering ----------
    def get_search_fields(self):
        # Prefer common text fields if present
        fields = []
        for cand in ("name", "entity_name", "full_name", "remarks"):
            if _has_field(Entity, cand):
                fields.append(cand)
        return fields

    def get_ordering_fields(self):
        fields = {"id"}  # always exists
        for cand in ("created_at", "created_on", "name", "status"):
            if _has_field(Entity, cand):
                fields.add(cand)
        return list(fields)

    def get_ordering(self):
        for cand in ("-created_at", "-created_on", "-id"):
            base = cand[1:] if cand.startswith("-") else cand
            if _has_field(Entity, base):
                return [cand]
        return ["-id"]

    # ---------- company guard helpers ----------
    def _assert_company_allowed(self, user, company):
        if is_super(user) or company is None:
            return
        companies_rel = getattr(user, "companies", None)
        if not companies_rel or company not in companies_rel.all():
            raise PermissionDenied("You are not allowed to use this company.")

    # ---------- create / update ----------
    def perform_create(self, serializer):
        user = self.request.user
        company = serializer.validated_data.get("company")

        if is_super(user):
            serializer.save()
            return

        companies_rel = getattr(user, "companies", None)
        if not companies_rel or not companies_rel.exists():
            from rest_framework import serializers as drf_serializers
            raise drf_serializers.ValidationError({"company": "You are not associated with any company."})

        if company:
            self._assert_company_allowed(user, company)
            serializer.save()
            return

        # no company provided
        if companies_rel.count() == 1:
            serializer.save(company=companies_rel.first())
        else:
            from rest_framework import serializers as drf_serializers
            raise drf_serializers.ValidationError(
                {"company": "Please specify a company (you belong to multiple companies)."}
            )

    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()
        target_company = serializer.validated_data.get("company", getattr(instance, "company", None))
        self._assert_company_allowed(user, target_company)
        serializer.save()

    # ---------- soft delete ----------
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if not is_super(request.user):
            self._assert_company_allowed(request.user, getattr(instance, "company", None))

        if _has_field(Entity, "status"):
            instance.status = "Inactive"
            instance.save(update_fields=["status"])
            return Response({"detail": "Entity soft-deleted (status set to Inactive)."}, status=status.HTTP_200_OK)

        # If no 'status' field exists, fall back to hard delete
        return super().destroy(request, *args, **kwargs)
