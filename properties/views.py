from django.core.exceptions import PermissionDenied
from django.db import transaction

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView

from .models import Property, PropertyDocument, PropertyKeyDate
from .serializers import (
    PropertySerializer,
    PropertyDocumentSerializer,
    PropertyKeyDateSerializer,
)
from companies.models import Company
from rest_framework import serializers as rest_serializers

from users.permissions_matrix_guard import RoleActionPermission


def is_super(user):
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"


PermProps = RoleActionPermission.bind(
    module="properties",
    action_map={
        "GET": "list",
        "POST": "create",
        "PUT": "update",
        "PATCH": "update",
        "DELETE": "delete",
    },
)


class CompanySerializer(rest_serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name"]


class PropertyViewSet(viewsets.ModelViewSet):
    serializer_class = PropertySerializer
    permission_classes = [IsAuthenticated, PermProps]

    def get_queryset(self):
        user = self.request.user
        qs = Property.objects.select_related("company").filter(is_active=True)

        try:
            qs = qs.prefetch_related("documents", "key_dates")
        except Exception:
            try:
                qs = qs.prefetch_related("propertydocument_set", "propertykeydate_set")
            except Exception:
                pass

        if is_super(user):
            return qs.order_by("-id")

        companies_rel = getattr(user, "companies", None)
        if companies_rel is not None and companies_rel.exists():
            return qs.filter(company__in=companies_rel.all()).order_by("-id")
        return qs.none()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        company = serializer.validated_data.get("company")
        if not is_super(user):
            if not getattr(user, "companies", None) or (
                company and company not in user.companies.all()
            ):
                raise PermissionDenied("You cannot create properties for this company.")
        serializer.save()

    @transaction.atomic
    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()
        target_company = serializer.validated_data.get("company", instance.company)
        if not is_super(user) and target_company not in user.companies.all():
            raise PermissionDenied("You cannot move/update properties to a company you don't belong to.")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        prop = self.get_object()
        prop.is_active = False
        prop.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        prop = self.get_object()
        prop.is_active = not bool(prop.is_active)
        prop.save(update_fields=["is_active"])
        return Response({"status": "success", "is_active": prop.is_active})


class PropertyDocumentViewSet(viewsets.ModelViewSet):
    queryset = PropertyDocument.objects.all().order_by("-id")
    serializer_class = PropertyDocumentSerializer
    permission_classes = [IsAuthenticated, PermProps]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset().select_related("property", "property__company")
        if is_super(user):
            return qs
        return qs.filter(property__company__in=user.companies.all())

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        prop = serializer.validated_data.get("property")
        if not prop:
            raise PermissionDenied("Property is required.")
        if not is_super(user) and prop.company not in user.companies.all():
            raise PermissionDenied("You cannot add documents for this company's property.")
        serializer.save()

    @transaction.atomic
    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()
        target_prop = serializer.validated_data.get("property", instance.property)
        if not is_super(user) and target_prop.company not in user.companies.all():
            raise PermissionDenied("You cannot move documents to a property in another company.")
        serializer.save()


class PropertyKeyDateViewSet(viewsets.ModelViewSet):
    queryset = PropertyKeyDate.objects.all().order_by("-id")
    serializer_class = PropertyKeyDateSerializer
    permission_classes = [IsAuthenticated, PermProps]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset().select_related("property", "property__company")
        if is_super(user):
            return qs
        return qs.filter(property__company__in=user.companies.all())

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        prop = serializer.validated_data.get("property")
        if not prop:
            raise PermissionDenied("Property is required.")
        if not is_super(user) and prop.company not in user.companies.all():
            raise PermissionDenied("You cannot add key dates for this company's property.")
        serializer.save()

    @transaction.atomic
    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()
        target_prop = serializer.validated_data.get("property", instance.property)
        if not is_super(user) and target_prop.company not in user.companies.all():
            raise PermissionDenied("You cannot move key dates to a property in another company.")
        serializer.save()


# ---- SHIM: keep old route /api/properties/ for FE master-data fetch ----
class PropertyListShim(APIView):
    """
    Read-only list that mirrors PropertyViewSet list at /api/properties/properties/.
    Keeps backward compatibility for clients calling GET /api/properties/.
    """
    permission_classes = [IsAuthenticated, PermProps]

    def get(self, request, *args, **kwargs):
        user = request.user
        qs = Property.objects.select_related("company").filter(is_active=True)
        if not is_super(user):
            rel = getattr(user, "companies", None)
            if not rel or not rel.exists():
                return Response([])
            qs = qs.filter(company__in=rel.all())
        data = PropertySerializer(qs, many=True, context={"request": request}).data
        return Response(data)
