from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from .models import Contract, ContractMilestone
from .serializers import ContractSerializer, ContractMilestoneSerializer
import os


class ContractViewSet(viewsets.ModelViewSet):
    serializer_class = ContractSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_USER':
            return Contract.objects.filter(is_active=True)
        return Contract.objects.filter(company__in=user.companies.all(), is_active=True)

    def create(self, request, *args, **kwargs):
        user = request.user
        data = request.data.copy()

        # Ensure company is set properly
        if user.role != 'SUPER_USER':
            company = user.companies.first()
            if not company:
                return Response(
                    {'company': ['User is not linked to any company.']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            data['company'] = company.id

        serializer = self.get_serializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        # Ensure is_active is explicitly set to True
        serializer.save(created_by=self.request.user, is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        contract = get_object_or_404(Contract, pk=pk)
        if not contract.document:
            return Response({"error": "No document found."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            contract.document.open(),
            as_attachment=True,
            filename=os.path.basename(contract.document.name)
        )


class ContractMilestoneViewSet(viewsets.ModelViewSet):
    queryset = ContractMilestone.objects.all()
    serializer_class = ContractMilestoneSerializer
    permission_classes = [IsAuthenticated]
