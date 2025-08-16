from rest_framework.routers import DefaultRouter
from .views import CompanyViewSet, CompanyDocumentViewSet  # ✅ Add CompanyDocumentViewSet import

# ✅ DRF router setup for Company and Document CRUD operations
router = DefaultRouter()
router.register(r'', CompanyViewSet, basename='companies')
router.register(r'company-documents', CompanyDocumentViewSet, basename='company-documents')  # ✅ Register documents

urlpatterns = router.urls  # ✅ Makes /api/companies/ and /api/company-documents/
