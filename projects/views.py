# projects/views.py
from django.core.exceptions import PermissionDenied
from django.db import transaction
from rest_framework import viewsets, status, filters, serializers
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
import logging, csv

from .models import Project, Property
from .serializers import ProjectSerializer, PropertySerializer
from contacts.models import Contact
from users.models import User
from users.permissions_matrix_guard import RoleActionPermission

logger = logging.getLogger(__name__)


def is_super(user):
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"


# ---- Permissions bindings ----
# Map HTTP → logical actions for the permissions matrix
PermProjects = RoleActionPermission.bind(
    module="projects",
    action_map={"GET": "list", "POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"},
)

# IMPORTANT:
# If you keep this embedded PropertyViewSet (historical shim), it must use the
# 'properties' module, not 'projects', so FE and BE rules match.
PermProps = RoleActionPermission.bind(
    module="properties",
    action_map={"GET": "list", "POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"},
)


def _safe_prefetch(qs, *rel_names):
    try:
        return qs.prefetch_related(*rel_names)
    except Exception:
        return qs


class ProjectViewSet(viewsets.ModelViewSet):
    """
    Canonical Projects API
    Permissions: users/permissions_matrix.py -> module 'projects'
    """
    # Ensure POST/PUT/PATCH/DELETE are enabled on the list/detail routes
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, PermProjects]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "company__name", "district", "city"]
    ordering_fields = ["start_date", "end_date", "id"]
    ordering = ["-id"]

    def get_queryset(self):
        user = self.request.user
        qs = Project.objects.select_related("company", "property_manager", "key_stakeholder")
        qs = _safe_prefetch(qs, "stakeholders", "key_dates", "milestones")

        if is_super(user):
            company_id = self.request.query_params.get("company")
            if company_id:
                qs = qs.filter(company_id=company_id)
            return qs.order_by(*self.ordering)

        companies_rel = getattr(user, "companies", None)
        if not companies_rel or not companies_rel.exists():
            return qs.none()
        return qs.filter(company__in=companies_rel.all()).order_by(*self.ordering)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if settings.DEBUG:
            logger.debug("Project.create data=%s", request.data)

        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)

        user = request.user
        provided_company = ser.validated_data.get("company")

        if is_super(user):
            if not provided_company:
                raise serializers.ValidationError({"company": "Super User must specify company explicitly."})
            instance = ser.save()
        else:
            rel = getattr(user, "companies", None)
            if not rel or not rel.exists():
                raise serializers.ValidationError({"company": "User is not linked to any company."})
            if provided_company:
                if provided_company not in rel.all():
                    raise PermissionDenied("You cannot create projects for this company.")
                company = provided_company
            else:
                if rel.count() == 1:
                    company = rel.first()
                else:
                    raise serializers.ValidationError({"company": "Please specify company (multiple assigned)."})
            instance = ser.save(company=company)

        headers = self.get_success_headers(ser.data)
        return Response(
            ProjectSerializer(instance, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()
        ser = self.get_serializer(instance, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)

        user = request.user
        target_company = ser.validated_data.get("company", instance.company)

        if not is_super(user):
            rel = getattr(user, "companies", None)
            if not rel or target_company not in rel.all():
                raise PermissionDenied("You cannot move/update projects to a company you don't belong to.")

        instance = ser.save()
        return Response(ProjectSerializer(instance, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if hasattr(instance, "is_active"):
            instance.is_active = False
            instance.save(update_fields=["is_active"])
            return Response({"status": "Project deactivated (soft delete)"}, status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="bulk_upload")
    @transaction.atomic
    def bulk_upload(self, request):
        file = self.request.FILES.get("file")
        if not file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded = file.read().decode("utf-8").splitlines()
            reader = csv.DictReader(decoded)
        except Exception as e:
            return Response({"error": "Invalid CSV format", "details": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        rel = getattr(user, "companies", None)

        results = []
        for i, row in enumerate(reader, start=1):
            stakeholder_ids = []
            for nm in (row.get("stakeholders") or "").split(";"):
                nm = nm.strip()
                if nm:
                    c = Contact.objects.filter(full_name__iexact=nm).first()
                    if c:
                        stakeholder_ids.append(c.id)

            pm_email = (row.get("property_manager_email") or "").strip()
            pm = User.objects.filter(email__iexact=pm_email, role="PROPERTY_MANAGER").first() if pm_email else None

            ks_name = (row.get("key_stakeholder") or "").strip()
            ks = Contact.objects.filter(full_name__iexact=ks_name).first() if ks_name else None

            provided_company_id = row.get("company")
            if is_super(user):
                company_payload = provided_company_id
            else:
                if not rel or not rel.exists():
                    results.append({"row": i, "status": "error", "errors": {"company": ["User not linked to any company."]}})
                    continue
                if provided_company_id:
                    if not rel.filter(id=provided_company_id).exists():
                        results.append({"row": i, "status": "error", "errors": {"company": ["Not allowed for this company."]}})
                        continue
                    company_payload = provided_company_id
                else:
                    company_payload = str(rel.first().id) if rel.count() == 1 else None
                    if not company_payload:
                        results.append({"row": i, "status": "error", "errors": {"company": ["Please provide company (multiple assigned)."]}})
                        continue

            clean = {
                "name": row.get("name"),
                "start_date": row.get("start_date"),
                "end_date": row.get("end_date"),
                "expected_return": row.get("expected_return"),
                "landmark": row.get("landmark"),
                "pincode": row.get("pincode"),
                "city": row.get("city"),
                "district": row.get("district"),
                "state": row.get("state") or "Kerala",
                "country": row.get("country") or "India",
                "stakeholder_ids": stakeholder_ids,
                "property_manager_id": pm.id if pm else None,
                "key_stakeholder_id": ks.id if ks else None,
                "company": company_payload,
                "project_type": row.get("project_type"),
                "project_status": row.get("project_status"),
            }
            ser = ProjectSerializer(data=clean, context={"request": request})
            if ser.is_valid():
                ser.save()
                results.append({"row": i, "status": "success"})
            else:
                results.append({"row": i, "status": "error", "errors": ser.errors})

        return Response({"results": results}, status=status.HTTP_200_OK)


class PropertyViewSet(viewsets.ModelViewSet):
    """
    Historical/embedded Properties API.

    ⚠️ Prefer the canonical Properties API in the `properties` app.
    If that one is registered in your router, DO NOT also register this class.
    It remains here only for legacy compatibility and uses the correct
    'properties' permissions module to match the matrix.
    """
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    serializer_class = PropertySerializer
    permission_classes = [IsAuthenticated, PermProps]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "project__name", "location"]
    ordering_fields = ["purchase_date", "purchase_price", "id"]
    ordering = ["-id"]

    def get_queryset(self):
        user = self.request.user
        qs = Property.objects.select_related("project", "project__company")
        if is_super(user):
            company_id = self.request.query_params.get("company")
            if company_id:
                qs = qs.filter(project__company_id=company_id)
            return qs.order_by(*self.ordering)

        rel = getattr(user, "companies", None)
        if not rel or not rel.exists():
            return qs.none()
        return qs.filter(project__company__in=rel.all()).order_by(*self.ordering)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if hasattr(instance, "is_active"):
            instance.is_active = False
            instance.save(update_fields=["is_active"])
            return Response({"status": "Property deactivated (soft delete)"}, status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)
