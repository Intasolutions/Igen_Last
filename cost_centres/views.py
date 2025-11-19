from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import CostCentre
from .serializers import CostCentreSerializer
from users.permissions_matrix_guard import RoleActionPermission

def _has_field(model, name: str) -> bool:
    try:
        return any(getattr(f, "name", None) == name for f in model._meta.get_fields())
    except Exception:
        return False

PermCostCentres = RoleActionPermission.for_module("cost_centres")

def is_super(user) -> bool:
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"

class CostCentreViewSet(viewsets.ModelViewSet):
    serializer_class = CostCentreSerializer
    permission_classes = [IsAuthenticated, PermCostCentres]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [f for f in ["company", "is_active"] if _has_field(CostCentre, f)]

    # only include 'name' if the model actually has it
    search_fields = [f for f in ["name"] if _has_field(CostCentre, f)]
    ordering_fields = [f for f in ["id", "name"] if _has_field(CostCentre, f)]
    ordering = ["-id"] if _has_field(CostCentre, "id") else []

    def get_queryset(self):
        user = self.request.user

        if is_super(user):
            include_inactive = (self.request.query_params.get("include_inactive") or "").lower() in ("1", "true", "yes")
            qs = CostCentre.objects.all()
            if _has_field(CostCentre, "is_active") and not include_inactive:
                qs = qs.filter(is_active=True)
            company_id = self.request.query_params.get("company")
            if company_id:
                try:
                    qs = qs.filter(company_id=int(company_id))
                except ValueError:
                    qs = qs.none()
            return qs.order_by(*self.ordering) if self.ordering else qs

        companies_rel = getattr(user, "companies", None)
        if not companies_rel:
            return CostCentre.objects.none()

        qs = CostCentre.objects.filter(company__in=companies_rel.all())
        if _has_field(CostCentre, "is_active"):
            qs = qs.filter(is_active=True)
        return qs.order_by(*self.ordering) if self.ordering else qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if _has_field(CostCentre, "is_active"):
            instance.is_active = False
            instance.save(update_fields=["is_active"])
            return Response({"detail": "Cost Centre soft-deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)
