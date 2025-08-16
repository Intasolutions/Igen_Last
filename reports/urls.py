from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TransactionLedgerViewSet

router = DefaultRouter()
router.register(r'entity-report', TransactionLedgerViewSet, basename='entity-report')

urlpatterns = [
    path('', include(router.urls)),
]
