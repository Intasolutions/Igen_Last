from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Entity
from .serializers import EntitySerializer


class EntityViewSet(viewsets.ModelViewSet):
    """
    CRUD for Entity.

    - Non–super users are scoped to their assigned companies.
    - Linkage rules (Property / Project / Contact / Internal) are validated
      in the serializer.
    - DELETE performs a soft delete by setting status='Inactive'.
    """
    serializer_class = EntitySerializer
    permission_classes = [IsAuthenticated]

    # Eager-load FKs and order by newest first
    queryset = (
        Entity.objects
        .select_related('company', 'linked_property', 'linked_project', 'linked_contact')
        .order_by('-created_at')
    )

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset

        # Treat either role-based SUPER_USER or Django is_superuser as super
        is_super = getattr(user, 'is_superuser', False) or getattr(user, 'role', None) == 'SUPER_USER'
        if is_super:
            return qs

        # Non-super: restrict to companies the user belongs to
        return qs.filter(company__in=user.companies.all())

    def perform_create(self, serializer):
        # All linkage validation lives in the serializer.
        serializer.save()

    def perform_update(self, serializer):
        # Same as create: just save after serializer validation.
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete: flip status to 'Inactive' instead of removing the row.
        """
        instance = self.get_object()
        instance.status = 'Inactive'
        instance.save(update_fields=['status'])
        return Response(
            {'detail': 'Entity soft-deleted (status set to Inactive).'},
            status=status.HTTP_200_OK
        )
