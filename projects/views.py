from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from .models import Project, Property
from .serializers import ProjectSerializer, PropertySerializer

from contacts.models import Contact
from users.models import User
from users.permissions import IsSuperUserOrCenterHead

import csv
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


# --------------------
# ViewSet: Project CRUD
# --------------------
class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsSuperUserOrCenterHead]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'company__name', 'district', 'city']
    ordering_fields = ['start_date', 'end_date']
    ordering = ['-start_date']

    def get_queryset(self):
        user = self.request.user
        base_qs = Project.objects.all()
        if user.role == 'SUPER_USER':
            return base_qs
        return base_qs.filter(company__in=user.companies.all())

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response({'status': 'Project deactivated (soft delete)'}, status=status.HTTP_204_NO_CONTENT)

    def create(self, request, *args, **kwargs):
        if settings.DEBUG:
            logger.debug("====== DEBUG: Entered ProjectViewSet.create() ======")
            logger.debug(f"Request user: {request.user}")
            logger.debug(f"Request data: {request.data}")

        response = super().create(request, *args, **kwargs)

        if settings.DEBUG:
            logger.debug(f"Response status: {response.status_code}")
            logger.debug(f"Response data: {response.data}")
            logger.debug("====== DEBUG END ======\n")

        return response


# ----------------------
# ViewSet: Property CRUD
# ----------------------
class PropertyViewSet(viewsets.ModelViewSet):
    serializer_class = PropertySerializer
    permission_classes = [IsSuperUserOrCenterHead]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'project__name', 'location']
    ordering_fields = ['purchase_date', 'purchase_price']
    ordering = ['-purchase_date']

    def get_queryset(self):
        return Property.objects.filter(is_active=True)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response({'status': 'Property deactivated (soft delete)'}, status=status.HTTP_204_NO_CONTENT)


# --------------------------
# API: Bulk Project CSV Upload
# --------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_upload(request):
    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        decoded_file = file.read().decode('utf-8').splitlines()
        reader = csv.DictReader(decoded_file)
    except Exception as e:
        return Response({'error': 'Invalid CSV format', 'details': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    results = []

    for i, row in enumerate(reader, start=1):
        stakeholder_names = row.get('stakeholders', '')
        stakeholder_ids = []
        if stakeholder_names:
            for name in stakeholder_names.split(';'):
                contact = Contact.objects.filter(name__iexact=name.strip()).first()
                if contact:
                    stakeholder_ids.append(contact.id)

        property_manager_email = row.get('property_manager_email')
        property_manager = None
        if property_manager_email:
            property_manager = User.objects.filter(email__iexact=property_manager_email.strip(), role='PROPERTY_MANAGER').first()

        key_stakeholder_name = row.get('key_stakeholder')
        key_stakeholder = Contact.objects.filter(name__iexact=key_stakeholder_name.strip()).first() if key_stakeholder_name else None

        clean_data = {
            'name': row.get('name'),
            'start_date': row.get('start_date'),
            'end_date': row.get('end_date'),
            'expected_return': row.get('expected_return'),
            'landmark': row.get('landmark'),
            'pincode': row.get('pincode'),
            'city': row.get('city'),
            'district': row.get('district'),
            'state': row.get('state') or 'Kerala',
            'country': row.get('country') or 'India',
            'stakeholders': stakeholder_ids,
            'property_manager_id': property_manager.id if property_manager else None,
            'key_stakeholder_id': key_stakeholder.id if key_stakeholder else None,
            'company': row.get('company'),  # Must be company ID
            'project_type': row.get('project_type'),
            'project_status': row.get('project_status'),
        }

        serializer = ProjectSerializer(data=clean_data)
        if serializer.is_valid():
            serializer.save()
            results.append({'row': i, 'status': 'success'})
        else:
            results.append({'row': i, 'status': 'error', 'errors': serializer.errors})

    return Response({'results': results}, status=status.HTTP_200_OK)
