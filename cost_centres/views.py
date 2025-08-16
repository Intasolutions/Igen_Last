from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CostCentre
from .serializers import CostCentreSerializer


class CostCentreViewSet(viewsets.ModelViewSet):
    serializer_class = CostCentreSerializer
    permission_classes = [IsAuthenticated]  # ✅ Allow all authenticated users

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_USER':
            return CostCentre.objects.all()
        return CostCentre.objects.filter(company__in=user.companies.all(), is_active=True)

    def create(self, request, *args, **kwargs):
        if request.user.role != 'SUPER_USER':
            return Response({'detail': 'Only superusers can create cost centres.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.role != 'SUPER_USER':
            return Response({'detail': 'Only superusers can update cost centres.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'SUPER_USER':
            return Response({'detail': 'Only superusers can delete cost centres.'}, status=status.HTTP_403_FORBIDDEN)

        instance = self.get_object()
        instance.is_active = False  # Soft delete
        instance.save()
        return Response(
            {'detail': 'Cost Centre soft-deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )
