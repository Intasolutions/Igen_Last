from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AssetViewSet, AssetDocumentViewSet, AssetServiceDueViewSet

router = DefaultRouter()
router.register(r'assets', AssetViewSet, basename='asset')
router.register(r'asset-documents', AssetDocumentViewSet, basename='assetdocument')
router.register(r'asset-service-dues', AssetServiceDueViewSet, basename='assetservicedue')

urlpatterns = [
    path('', include(router.urls)),
]
