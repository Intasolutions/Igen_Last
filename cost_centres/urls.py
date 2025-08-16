from rest_framework.routers import DefaultRouter
from .views import CostCentreViewSet

router = DefaultRouter()
router.register(r'', CostCentreViewSet, basename='cost-centres')

urlpatterns = router.urls
