from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import BankAccount
from .serializers import BankAccountSerializer

class BankAccountViewSet(viewsets.ModelViewSet):
    """
    Handles CRUD for BankAccount, with soft delete
    and optional inclusion of inactive records via query params.
    """
    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # ✅ Include inactive records if requested
        include_inactive = self.request.query_params.get('include_inactive', 'false').lower() == 'true'

        if include_inactive or self.action in ['partial_update', 'destroy']:
            base_queryset = BankAccount.objects.all()
        else:
            base_queryset = BankAccount.objects.filter(is_active=True)

        # ✅ Role-based filtering
        if user.role == 'SUPER_USER':
            return base_queryset

        elif user.role == 'ACCOUNTANT':
            return base_queryset.filter(company__in=user.companies.all())

        return BankAccount.objects.none()

    def get_object(self):
        """
        Override to allow retrieving inactive records for PATCH/DELETE.
        """
        queryset = BankAccount.objects.all()
        obj = get_object_or_404(queryset, pk=self.kwargs["pk"])
        self.check_object_permissions(self.request, obj)
        return obj

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete: mark the bank account as inactive.
        """
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response({'status': 'Bank account deactivated'}, status=status.HTTP_204_NO_CONTENT)

    def partial_update(self, request, *args, **kwargs):
        """
        Handle PATCH request to reactivate/deactivate.
        """
        instance = self.get_object()
        is_active = request.data.get("is_active", None)

        if is_active is not None:
            instance.is_active = is_active
            instance.save()
            status_text = "activated" if is_active else "deactivated"
            return Response({"status": f"Bank account {status_text}"})

        return super().partial_update(request, *args, **kwargs)
