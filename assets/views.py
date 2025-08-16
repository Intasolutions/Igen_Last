from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Asset, AssetDocument, AssetServiceDue
from .serializers import AssetSerializer, AssetDocumentSerializer, AssetServiceDueSerializer
from rest_framework.permissions import IsAuthenticated

class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated]
  

    def get_queryset(self):
        user = self.request.user
        base_queryset = Asset.objects.all()
        if user.role == 'SUPER_USER':
            return base_queryset.order_by('-created_at')
        return base_queryset.filter(company__in=user.companies.all()).order_by('-created_at')

    def perform_create(self, serializer):
        asset = serializer.save()

        # Save service dues
        service_dues = self.request.data.get('service_dues')
        if service_dues:
            import json
            dues_data = json.loads(service_dues)
            for due in dues_data:
                if due.get("due_date") and due.get("description"):
                    AssetServiceDue.objects.create(asset=asset, **due)

        # Save documents
        for file in self.request.FILES.getlist('documents'):
            AssetDocument.objects.create(asset=asset, document=file)

    def perform_update(self, serializer):
        asset = serializer.save()

        # (Optional) Delete existing service dues if needed:
        AssetServiceDue.objects.filter(asset=asset).delete()

        # Save new service dues
        service_dues = self.request.data.get('service_dues')
        if service_dues:
            import json
            dues_data = json.loads(service_dues)
            for due in dues_data:
                if due.get("due_date") and due.get("description"):
                    AssetServiceDue.objects.create(asset=asset, **due)

        # Save new documents
        for file in self.request.FILES.getlist('documents'):
            AssetDocument.objects.create(asset=asset, document=file)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

class AssetDocumentViewSet(viewsets.ModelViewSet):
    queryset = AssetDocument.objects.all()
    serializer_class = AssetDocumentSerializer
    permission_classes = [IsAuthenticated]

class AssetServiceDueViewSet(viewsets.ModelViewSet):
    queryset = AssetServiceDue.objects.all()
    serializer_class = AssetServiceDueSerializer
    permission_classes = [IsAuthenticated]
