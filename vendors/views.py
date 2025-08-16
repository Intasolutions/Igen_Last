from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import Vendor
from .serializers import VendorSerializer
from users.permissions import IsSuperUserOrPropertyManager


class VendorViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Vendor data with filtering, searching, and ordering.
    Access:
      - SUPER_USER: All vendors
      - PROPERTY_MANAGER: Vendors of their assigned company
    """
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated, IsSuperUserOrPropertyManager]

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = ['vendor_type']
    search_fields = [
        'vendor_name',
        'contact_person',
        'pan_number',
        'gst_number',
        'email',
        'phone_number'
    ]
    ordering_fields = ['created_on', 'vendor_name']

    def get_queryset(self):
        user = self.request.user

        if user.role == 'SUPER_USER':
            return Vendor.objects.all().order_by('-created_on')
        elif user.role == 'PROPERTY_MANAGER':
            company = user.companies.first()  # handle ManyToMany
            if company:
                return Vendor.objects.filter(company=company).order_by('-created_on')
            return Vendor.objects.none()

        # Fallback: user with multiple companies (future roles)
        return Vendor.objects.filter(company__in=user.companies.all()).order_by('-created_on')

    def perform_create(self, serializer):
        user = self.request.user

        if user.role == 'PROPERTY_MANAGER':
            company = user.companies.first()
            if not company:
                raise ValueError("No company associated with PROPERTY_MANAGER user.")
            serializer.save(created_by=user, company=company)
        else:
            # SUPER_USER must send `company` from frontend
            serializer.save(created_by=user)
