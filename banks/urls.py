from rest_framework.routers import DefaultRouter
from .views import BankAccountViewSet

router = DefaultRouter()
router.register(r'', BankAccountViewSet, basename='banks')

urlpatterns = router.urls
