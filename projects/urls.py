from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, PropertyViewSet, bulk_upload

# Initialize the router and register viewsets
router = DefaultRouter()
router.register(r'', ProjectViewSet, basename='projects')  # This maps /api/projects/
router.register(r'properties', PropertyViewSet, basename='project-properties')  # Maps /api/projects/properties/

# Combine router and custom endpoints
urlpatterns = [
    path('', include(router.urls)),  # This includes all CRUD endpoints for projects and properties
    path('bulk_upload/', bulk_upload, name='projects-bulk-upload'),  # Maps to /api/projects/bulk_upload/
]
