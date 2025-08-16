from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CashLedgerRegisterViewSet

router = DefaultRouter()
router.register(r'', CashLedgerRegisterViewSet, basename='cash-ledger')

urlpatterns = [
    path('', include(router.urls)),
]
