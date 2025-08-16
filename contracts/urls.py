from rest_framework.routers import DefaultRouter
from .views import ContractViewSet, ContractMilestoneViewSet

router = DefaultRouter()

# Main contract management routes
router.register(r'contracts', ContractViewSet, basename='contract')

# Milestone routes (keep only if milestones are also managed via a separate API)
router.register(r'contract-milestones', ContractMilestoneViewSet, basename='contract-milestone')

urlpatterns = router.urls
