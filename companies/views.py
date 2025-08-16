from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Company, CompanyDocument
from .serializers import CompanySerializer, CompanyDocumentSerializer
from users.permissions import IsSuperUser

class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated]  # ✅ Allow authenticated users with role logic

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_USER':
            return Company.objects.all()
        elif user.role == 'PROPERTY_MANAGER':
            return Company.objects.all()
        return Company.objects.filter(id__in=user.companies.values_list('id', flat=True))

    def destroy(self, request, *args, **kwargs):
        """
        ✅ Soft delete: mark company as inactive
        """
        company = self.get_object()
        company.is_active = False
        company.save()
        return Response({'detail': 'Company marked as inactive.'}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[IsSuperUser])
    def upload_document(self, request, pk=None):
        company = self.get_object()
        files = request.FILES.getlist('documents')
        if len(files) > 10:
            return Response({'error': 'You can upload a maximum of 10 documents.'}, status=status.HTTP_400_BAD_REQUEST)
        created = []
        for f in files:
            if f.size > 5 * 1024 * 1024:
                return Response({'error': f'{f.name} exceeds 5MB limit.'}, status=status.HTTP_400_BAD_REQUEST)
            doc = CompanyDocument.objects.create(company=company, file=f)
            created.append(CompanyDocumentSerializer(doc).data)
        return Response({'uploaded': created}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='bulk_upload', permission_classes=[IsSuperUser])
    def bulk_upload(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        import csv
        decoded_file = file.read().decode('utf-8').splitlines()
        reader = csv.DictReader(decoded_file)
        results = []
        for i, row in enumerate(reader, start=1):
            serializer = CompanySerializer(data=row)
            if serializer.is_valid():
                serializer.save()
                results.append({'row': i, 'status': 'success'})
            else:
                results.append({'row': i, 'status': 'error', 'errors': serializer.errors})

        return Response({'results': results})


class CompanyDocumentViewSet(viewsets.ModelViewSet):
    queryset = CompanyDocument.objects.all()
    serializer_class = CompanyDocumentSerializer
    permission_classes = [IsSuperUser]

    def destroy(self, request, *args, **kwargs):
        try:
            document = self.get_object()
            document.delete()
            return Response({"detail": "Document deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
