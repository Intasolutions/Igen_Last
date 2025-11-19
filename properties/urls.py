from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    PropertyViewSet,
    PropertyDocumentViewSet,
    PropertyKeyDateViewSet,
    PropertyListShim,   # <-- shim import
)

router = DefaultRouter()
router.register(r'properties', PropertyViewSet, basename='properties')
router.register(r'property-documents', PropertyDocumentViewSet, basename='property-documents')
router.register(r'property-key-dates', PropertyKeyDateViewSet, basename='property-key-dates')

urlpatterns = [
    # Back-compat shim: GET /api/properties/ -> list of properties
    path('', PropertyListShim.as_view(), name='properties-shim'),
]

urlpatterns += router.urls
