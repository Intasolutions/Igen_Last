from rest_framework.routers import DefaultRouter
from .views import TransactionTypeViewSet

router = DefaultRouter()
router.register(r'', TransactionTypeViewSet, basename='transaction-types')

urlpatterns = router.urls
