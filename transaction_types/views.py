from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import TransactionType
from .serializers import TransactionTypeSerializer

class TransactionTypeViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionTypeSerializer
    permission_classes = [IsAuthenticated]  # ✅ Allow all logged-in users

    def get_queryset(self):
        user = self.request.user

        # SUPER_USER can access everything
        if user.role == 'SUPER_USER':
            queryset = TransactionType.objects.all()
        else:
            queryset = TransactionType.objects.filter(company__in=user.companies.all())

        # Optional filters from query params (case-insensitive)
        direction = self.request.query_params.get('direction')
        status_param = self.request.query_params.get('status')

        if direction:
            queryset = queryset.filter(direction__iexact=direction)

        if status_param:
            queryset = queryset.filter(status__iexact=status_param)

        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.status = 'Inactive'  # Soft delete by marking as Inactive
        instance.save()
        return Response(
            {'detail': 'Transaction Type soft-deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )
