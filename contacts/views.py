from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.exceptions import PermissionDenied
from django.db import IntegrityError
from rest_framework.exceptions import ValidationError as DRFValidationError

from .models import Contact
from .serializers import ContactSerializer
from users.permissions_matrix_guard import RoleActionPermission


def is_super(user) -> bool:
    return getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER"


PermContacts = RoleActionPermission.for_module("contacts")


class ContactViewSet(viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated, PermContacts]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "company": ["exact"],
        "is_active": ["exact"],
        "type": ["exact"],
    }
    search_fields = ["full_name", "email", "phone", "alternate_phone"]
    ordering_fields = ["contact_id", "full_name", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        qs = Contact.objects.select_related("company").all()
        if is_super(user):
            return qs
        rel = getattr(user, "companies", None)
        if not rel:
            return qs.none()
        return qs.filter(company__in=rel.all())

    # ---------- Hard JSON responses so UI sees field errors ----------
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except DRFValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            # DB unique hit (race condition etc.)
            return Response({"phone": ["This mobile number is already in use."]},
                            status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)
        except DRFValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response({"phone": ["This mobile number is already in use."]},
                            status=status.HTTP_400_BAD_REQUEST)

    # ---------- Business rules & safety nets ----------
    def perform_create(self, serializer):
        user = self.request.user
        company = serializer.validated_data.get("company")

        try:
            if is_super(user):
                # allow SUPER_USER to save with or without company
                serializer.save(company=company, created_by=user)
                return

            rel = getattr(user, "companies", None)
            if not rel or not rel.exists():
                raise PermissionDenied("User is not linked to any company.")

            if company:
                if not rel.filter(pk=company.pk).exists():
                    raise PermissionDenied("You cannot create contacts for this company.")
                serializer.save(created_by=user)
            else:
                if rel.count() == 1:
                    serializer.save(company=rel.first(), created_by=user)
                else:
                    raise PermissionDenied("Please select a company.")
        except IntegrityError as e:
            if "phone" in str(e).lower():
                raise DRFValidationError({"phone": ["This mobile number is already in use."]})
            raise

    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()
        target_company = serializer.validated_data.get("company", instance.company)

        if not is_super(user):
            rel = getattr(user, "companies", None)
            if not rel:
                raise PermissionDenied("User is not linked to any company.")

            # If a target company is provided, ensure the user belongs to it.
            if target_company is not None:
                if not rel.filter(pk=target_company.pk).exists():
                    raise PermissionDenied(
                        "You cannot move/update contacts to a company you don't belong to."
                    )
            else:
                # Prevent clearing company for non-super users if the record currently has one
                if instance.company is not None:
                    raise PermissionDenied("You cannot clear the company on this contact.")

        try:
            serializer.save()
        except IntegrityError as e:
            if "phone" in str(e).lower():
                raise DRFValidationError({"phone": ["This mobile number is already in use."]})
            raise

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if hasattr(instance, "is_active"):
            instance.is_active = False
            instance.save(update_fields=["is_active"])
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)
