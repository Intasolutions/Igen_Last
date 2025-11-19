# vendors/views.py
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import Vendor
from .serializers import VendorSerializer
from users.permissions_matrix_guard import RoleActionPermission

def is_super(user):
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"

PermVendors = RoleActionPermission.for_module("vendors")

def _field_exists(model, name: str) -> bool:
    return any(getattr(f, "name", None) == name for f in model._meta.get_fields())


class VendorViewSet(viewsets.ModelViewSet):
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated, PermVendors]

    queryset = Vendor.objects.select_related("company").all().order_by("-id")

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["vendor_type", "is_active", "company"]
    search_fields = []
    ordering_fields = []
    ordering = ["-id"]

    def get_search_fields(self):
        cands = (
            "vendor_name", "contact_person", "pan_number", "gst_number",
            "email", "phone_number", "address", "ifsc",
        )
        return [c for c in cands if _field_exists(Vendor, c)]

    def get_ordering_fields(self):
        fields = {"id"}
        for cand in ("created_at", "created_on", "vendor_name"):
            if _field_exists(Vendor, cand):
                fields.add(cand)
        return list(fields)

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        if is_super(user):
            company_id = self.request.query_params.get("company_id")
            if company_id:
                qs = qs.filter(company_id=company_id)
            return qs

        companies_rel = getattr(user, "companies", None)
        if not companies_rel:
            return qs.none()
        return qs.filter(company__in=companies_rel.all())

    def perform_create(self, serializer):
        user = self.request.user

        if is_super(user):
            if not serializer.initial_data.get("company_id"):
                raise ValidationError({"company_id": ["This field is required for SUPER_USER."]})
            serializer.save(created_by=user)
            return

        companies_rel = getattr(user, "companies", None)
        company = companies_rel.first() if companies_rel else None
        if not company:
            raise ValidationError({"company_id": ["No company associated with this user."]})
        serializer.save(created_by=user, company=company)

    def perform_update(self, serializer):
        user = self.request.user
        if is_super(user):
            serializer.save()
            return

        companies_rel = getattr(user, "companies", None)
        company = companies_rel.first() if companies_rel else None
        if not company:
            raise ValidationError({"company_id": ["No company associated with this user."]})
        serializer.save(company=company)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if _field_exists(Vendor, "is_active"):
            instance.is_active = False
            instance.save(update_fields=["is_active"])
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)
