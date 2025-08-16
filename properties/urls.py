from rest_framework.routers import DefaultRouter
from .views import PropertyViewSet, PropertyDocumentViewSet, PropertyKeyDateViewSet

router = DefaultRouter()
router.register(r'properties', PropertyViewSet, basename='properties')
router.register(r'property-documents', PropertyDocumentViewSet, basename='property-documents')
router.register(r'property-key-dates', PropertyKeyDateViewSet, basename='property-key-dates')

urlpatterns = router.urls
