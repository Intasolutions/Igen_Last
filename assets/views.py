from django.db import transaction
from rest_framework import viewsets, status, serializers
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Asset, AssetDocument, AssetServiceDue
from .serializers import AssetSerializer, AssetDocumentSerializer, AssetServiceDueSerializer

import json

# role-matrix guard
from users.permissions_matrix_guard import RoleActionPermission


def is_super(user):
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"


# Bind matrix to this module; map HTTP verbs to logical actions
PermAssets = RoleActionPermission.for_module(
    module="assets",
    action_map={
        "GET": "list",
        "POST": "create",
        "PUT": "update",
        "PATCH": "update",
        "DELETE": "delete",
    },
)


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated, PermAssets]
    parser_classes = [MultiPartParser, FormParser]
    queryset = (
        Asset.objects.select_related("company", "property", "project", "entity")
        .prefetch_related("service_dues", "documents")
        .order_by("-created_at")
    )

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if is_super(user):
            return qs
        # strict company scoping
        return qs.filter(company__in=user.companies.all())

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def _parse_dues(self, raw):
        if not raw:
            return []
        if isinstance(raw, list):
            return raw
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            raise ValidationError({"service_dues": "Invalid JSON for service_dues."})

    @transaction.atomic
    def perform_create(self, serializer):
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
                    raise PermissionDenied("You cannot create assets for this company.")
                company = provided_company
            else:
                # auto-assign if the user belongs to exactly one company
                count = companies_rel.count()
                if count == 1:
                    company = companies_rel.first()
                else:
                    raise serializers.ValidationError(
                        "Please specify company (you belong to multiple companies)."
                    )

        asset = serializer.save(company=company)

        # Save service dues (optional)
        dues_data = self._parse_dues(self.request.data.get("service_dues"))
        for due in dues_data:
            if due.get("due_date") and due.get("description"):
                AssetServiceDue.objects.create(
                    asset=asset,
                    due_date=due["due_date"],
                    description=due["description"],
                    completed=bool(due.get("completed", False)),
                )

        # Save documents (optional)
        for file in self.request.FILES.getlist("documents"):
            AssetDocument.objects.create(asset=asset, document=file)

    @transaction.atomic
    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()

        # If company is being changed, enforce scoping
        target_company = serializer.validated_data.get("company", instance.company)
        if not is_super(user):
            companies_rel = getattr(user, "companies", None)
            if not companies_rel or target_company not in companies_rel.all():
                raise PermissionDenied("You cannot move/update assets to a company you don't belong to.")

        asset = serializer.save()

        # Replace dues (simple strategy)
        AssetServiceDue.objects.filter(asset=asset).delete()
        dues_data = self._parse_dues(self.request.data.get("service_dues"))
        for due in dues_data:
            if due.get("due_date") and due.get("description"):
                AssetServiceDue.objects.create(
                    asset=asset,
                    due_date=due["due_date"],
                    description=due["description"],
                    completed=bool(due.get("completed", False)),
                )

        # Append new documents (keep existing)
        for file in self.request.FILES.getlist("documents"):
            AssetDocument.objects.create(asset=asset, document=file)

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete: set is_active=False
        """
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class AssetDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = AssetDocumentSerializer
    permission_classes = [IsAuthenticated, PermAssets]
    queryset = AssetDocument.objects.select_related("asset", "asset__company")

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if is_super(user):
            return qs
        # scope documents by owning asset's company
        return qs.filter(asset__company__in=user.companies.all())


class AssetServiceDueViewSet(viewsets.ModelViewSet):
    serializer_class = AssetServiceDueSerializer
    permission_classes = [IsAuthenticated, PermAssets]
    queryset = AssetServiceDue.objects.select_related("asset", "asset__company")

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if is_super(user):
            return qs
        # correct scoping path
        return qs.filter(asset__company__in=user.companies.all())
