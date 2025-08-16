from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from .views import dashboard_stats, spend_by_cost_centre, top_vendors_by_spend

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/dashboard-stats/', dashboard_stats, name='dashboard_stats'),
    path('api/spend-by-cost-centre/', spend_by_cost_centre, name='spend_by_cost_centre'),
    path('api/top-vendors-by-spend/', top_vendors_by_spend, name='top_vendors_by_spend'),
    path('api/users/', include('users.urls')),
    path('api/companies/', include('companies.urls')),
    path('api/banks/', include('banks.urls')),
    path('api/cost-centres/', include('cost_centres.urls')),
    path('api/transaction-types/', include('transaction_types.urls')),
    path('api/projects/', include('projects.urls')),
    path('api/entities/', include('entities.urls')),
    path('api/receipts/', include('receipts.urls')),
    path('api/assets/', include('assets.urls')),
    path('api/contacts/', include('contacts.urls')),
    path('api/vendors/', include('vendors.urls')),
    path('api/contracts/', include('contracts.urls')),
    path('api/properties/', include('properties.urls')),
    path('api/cash-ledger/', include('cash_ledger.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/bank-uploads/', include('bank_uploads.urls')),
    path('api/tx-classify/', include('tx_classify.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    