from django.urls import path
from .views import (
    # Debug / diagnostics
    AnalyticsHealthView,
    AnalyticsDataProbeView,

    # Utility
    EntityQuickSearchView,  # ← NEW

    # R1 – Entity statement
    EntityStatementView,
    EntityStatementPDFView,
    EntityStatementDOCXView,   # ← NEW
    EntityStatementExcelView,  # ← NEW

    # R2 – Maintenance & Interior (YTD)
    MIExpensesSummaryView,
    MIExpensesEntitiesView,
    MIExpensesTransactionsView,
    MIExpensesExportView,

    # R3 – Owner rental
    OwnerRentalSummaryView,
    OwnerRentalPropertiesView,
    OwnerRentalPropertyPatchView,
    OwnerRentalPropertyStatementPDFView,    # ← NEW
    OwnerRentalPropertyStatementDOCXView,   # ← NEW
    OwnerRentalPropertyStatementExcelView,  # ← NEW

    # R4 – Project profitability
    ProjectProfitabilitySummaryView,
    ProjectProfitabilityTransactionsView,
    ProjectProfitabilityExportView,

    # R5 – Financial dashboard (pivot)
    FinancialDashboardPivotView,
    FinancialDashboardExportView,
)

app_name = "analytics"

urlpatterns = [
    # Debug / diagnostics
    path("health/", AnalyticsHealthView.as_view(), name="health"),
    path("probe/", AnalyticsDataProbeView.as_view(), name="probe"),

    # Utility
    path("entities/search/", EntityQuickSearchView.as_view(), name="entity-search"),  # ← NEW

    # R1 – Entity statement
    path("entity-statement/", EntityStatementView.as_view(), name="entity-statement"),
    path("entity-statement/pdf/", EntityStatementPDFView.as_view(), name="entity-statement-pdf"),
    path("entity-statement/docx/", EntityStatementDOCXView.as_view(), name="entity-statement-docx"),
    path("entity-statement/xlsx/", EntityStatementExcelView.as_view(), name="entity-statement-xlsx"),

    # R2 – Maintenance & Interior (YTD)
    path("mi/summary/", MIExpensesSummaryView.as_view(), name="mi-summary"),
    path("mi/entities/", MIExpensesEntitiesView.as_view(), name="mi-entities"),
    path("mi/transactions/", MIExpensesTransactionsView.as_view(), name="mi-transactions"),
    path("mi/export/", MIExpensesExportView.as_view(), name="mi-export"),

    # R3 – Owner rental
    path("owner-rental/summary/", OwnerRentalSummaryView.as_view(), name="owner-rental-summary"),
    path("owner-rental/properties/", OwnerRentalPropertiesView.as_view(), name="owner-rental-properties"),
    path(
        "owner-rental/property/<int:pk>/",
        OwnerRentalPropertyPatchView.as_view(),
        name="owner-rental-property-patch",
    ),
    path(
        "owner-rental/property-statement/pdf/",
        OwnerRentalPropertyStatementPDFView.as_view(),
        name="owner-rental-property-statement-pdf",
    ),
    path(
        "owner-rental/property-statement/docx/",
        OwnerRentalPropertyStatementDOCXView.as_view(),
        name="owner-rental-property-statement-docx",
    ),
    path(
        "owner-rental/property-statement/xlsx/",
        OwnerRentalPropertyStatementExcelView.as_view(),
        name="owner-rental-property-statement-xlsx",
    ),

    # R4 – Project profitability
    path("project/summary/", ProjectProfitabilitySummaryView.as_view(), name="project-summary"),
    path("project/transactions/", ProjectProfitabilityTransactionsView.as_view(), name="project-transactions"),
    path("project/export/", ProjectProfitabilityExportView.as_view(), name="project-export"),

    # R5 – Financial dashboard (pivot)
    path("pivot/", FinancialDashboardPivotView.as_view(), name="pivot"),
    path("pivot/export/", FinancialDashboardExportView.as_view(), name="pivot-export"),
]
