# projects/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, PropertyViewSet  # include if you use properties

router = DefaultRouter()
router.register(r'', ProjectViewSet, basename='projects')           # ← empty prefix
router.register(r'properties', PropertyViewSet, basename='project-properties')  # optional

urlpatterns = [
    path('', include(router.urls)),
]
