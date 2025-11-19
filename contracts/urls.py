from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, status
from rest_framework.response import Response

from .views import (
    ContractViewSet,
    ContractMilestoneListCreate,
    ContractMilestoneDetail,
)

# Optional: back-compat stub so old builds that still call /contracts/contract-milestones/ don't crash
class ContractMilestoneViewSet(viewsets.ViewSet):
    def list(self, request):
        return Response([], status=status.HTTP_200_OK)

router = DefaultRouter()
router.register(r'', ContractViewSet, basename='contracts')
router.register(r'contract-milestones', ContractMilestoneViewSet, basename='contract-milestones')

urlpatterns = [
    path('', include(router.urls)),

    # Nested milestones (what the new FE uses)
    path('<int:contract_pk>/milestones/', ContractMilestoneListCreate.as_view(),
         name='contract-milestone-list'),
    path('<int:contract_pk>/milestones/<int:pk>/', ContractMilestoneDetail.as_view(),
         name='contract-milestone-detail'),
]
