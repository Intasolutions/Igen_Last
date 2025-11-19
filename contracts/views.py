# contracts/views.py
from django.core.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters, status, generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import Contract, ContractMilestone
from .serializers import ContractSerializer, ContractMilestoneSerializer
from companies.models import Company
from vendors.models import Vendor
from entities.models import Entity
from cost_centres.models import CostCentre
from users.permissions_matrix_guard import RoleActionPermission


def is_super(user) -> bool:
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"


PermContracts = RoleActionPermission.for_module("contracts")


class ContractViewSet(viewsets.ModelViewSet):
    """
    Company inference + cross-company consistency checks on vendor/entity/cost_centre.
    Non-super users are restricted to their companies.
    """
    serializer_class = ContractSerializer
    permission_classes = [IsAuthenticated, PermContracts]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["company", "vendor", "entity", "cost_centre", "is_active"]
    search_fields = ["description", "vendor__vendor_name", "entity__name"]
    ordering_fields = ["id", "start_date", "end_date", "created_on"]
    ordering = ["-id"]

    queryset = (
        Contract.objects
        .select_related("company", "vendor", "entity", "cost_centre")
        .all()
    )

    # ---------- scoping ----------
    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if is_super(user):
            return qs
        rel = getattr(user, "companies", None)
        if not rel:
            return qs.none()
        return qs.filter(company__in=rel.all())

    # ---------- helpers ----------
    @staticmethod
    def _collect_candidate_company_ids(vd: Vendor | None, ent: Entity | None, cc: CostCentre | None) -> set[int]:
        ids = set()
        if vd and getattr(vd, "company_id", None):
            ids.add(vd.company_id)
        if ent and getattr(ent, "company_id", None):
            ids.add(ent.company_id)
        if cc and getattr(cc, "company_id", None):
            ids.add(cc.company_id)
        return ids

    def _pick_company(self, *, user, provided_company: Company | None,
                      vd: Vendor | None, ent: Entity | None, cc: CostCentre | None) -> Company:
        # 1) explicit beats inference
        if provided_company:
            return provided_company

        # 2) infer from relateds
        candidate_ids = self._collect_candidate_company_ids(vd, ent, cc)
        if len(candidate_ids) == 1:
            cid = next(iter(candidate_ids))
            return Company.objects.get(pk=cid)
        if len(candidate_ids) > 1:
            raise ValidationError({"company": ["Vendor/Entity/Cost Centre belong to different companies."]})

        # 3) fall back to user's single company
        if not is_super(user):
            rel = getattr(user, "companies", None)
            if rel and rel.count() == 1:
                return rel.first()

        # 4) no way to decide
        raise ValidationError({"company": ["Company information is missing. Select a company "
                                           "or choose vendor/entity/cost centre linked to one company."]})

    def _ensure_relateds_match_company(self, *, company: Company, vd: Vendor | None, ent: Entity | None, cc: CostCentre | None):
        for obj, name in ((vd, "vendor"), (ent, "entity"), (cc, "cost_centre")):
            if obj and getattr(obj, "company_id", None) != company.id:
                raise ValidationError({name: [f"{name.replace('_',' ').title()} belongs to a different company."]})

    def _enforce_company_scope(self, *, user, company: Company):
        if is_super(user):
            return
        rel = getattr(user, "companies", None)
        if not rel or not rel.filter(pk=company.pk).exists():
            raise PermissionDenied("You cannot create/update contracts for this company.")

    # ---------- create/update ----------
    def perform_create(self, serializer):
        user = self.request.user
        vd: Vendor | None = serializer.validated_data.get("vendor")
        ent: Entity | None = serializer.validated_data.get("entity")
        cc: CostCentre | None = serializer.validated_data.get("cost_centre")
        provided_company: Company | None = serializer.validated_data.get("company")

        company = self._pick_company(user=user, provided_company=provided_company, vd=vd, ent=ent, cc=cc)

        self._enforce_company_scope(user=user, company=company)
        self._ensure_relateds_match_company(company=company, vd=vd, ent=ent, cc=cc)

        serializer.save(company=company)

    def perform_update(self, serializer):
        user = self.request.user
        instance: Contract = self.get_object()

        vd: Vendor | None = serializer.validated_data.get("vendor", instance.vendor)
        ent: Entity | None = serializer.validated_data.get("entity", instance.entity)
        cc: CostCentre | None = serializer.validated_data.get("cost_centre", instance.cost_centre)
        target_company: Company | None = serializer.validated_data.get("company")

        company = self._pick_company(user=user, provided_company=target_company, vd=vd, ent=ent, cc=cc)

        self._enforce_company_scope(user=user, company=company)
        self._ensure_relateds_match_company(company=company, vd=vd, ent=ent, cc=cc)

        serializer.save(company=company)

    # ---------- soft delete ----------
    def destroy(self, request, *args, **kwargs):
        instance: Contract = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# =============================================================================
# Milestones (nested under /contracts/<contract_pk>/milestones/...)
# =============================================================================

class _MilestoneBase:
    permission_classes = [IsAuthenticated, PermContracts]
    serializer_class = ContractMilestoneSerializer

    def _user_can_access_contract(self, contract: Contract) -> bool:
        user = self.request.user
        if is_super(user):
            return True
        rel = getattr(user, "companies", None)
        return bool(rel and rel.filter(pk=contract.company_id).exists())


class ContractMilestoneListCreate(_MilestoneBase, generics.ListCreateAPIView):
    """
    GET  /contracts/<contract_pk>/milestones/
    POST /contracts/<contract_pk>/milestones/
    """
    def get_queryset(self):
        contract_pk = self.kwargs["contract_pk"]
        qs = ContractMilestone.objects.select_related("contract").filter(contract_id=contract_pk)
        user = self.request.user
        if is_super(user):
            return qs
        rel = getattr(user, "companies", None)
        if not rel:
            return qs.none()
        return qs.filter(contract__company__in=rel.all())

    def perform_create(self, serializer):
        contract_pk = self.kwargs["contract_pk"]
        try:
            contract = Contract.objects.select_related("company").get(pk=contract_pk)
        except Contract.DoesNotExist:
            raise ValidationError({"contract": ["Invalid contract id."]})

        if not self._user_can_access_contract(contract):
            raise PermissionDenied("You cannot add milestones for this contract.")

        serializer.save(contract=contract)


class ContractMilestoneDetail(_MilestoneBase, generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /contracts/<contract_pk>/milestones/<pk>/
    PATCH  /contracts/<contract_pk>/milestones/<pk>/
    DELETE /contracts/<contract_pk>/milestones/<pk>/
    """
    lookup_field = "pk"

    def get_queryset(self):
        contract_pk = self.kwargs["contract_pk"]
        qs = ContractMilestone.objects.select_related("contract").filter(contract_id=contract_pk)
        user = self.request.user
        if is_super(user):
            return qs
        rel = getattr(user, "companies", None)
        if not rel:
            return qs.none()
        return qs.filter(contract__company__in=rel.all())
