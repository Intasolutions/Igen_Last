from django.contrib import admin
from .models import Classification

@admin.register(Classification)
class ClassificationAdmin(admin.ModelAdmin):
    list_display = (
        "classification_id",
        "bank_transaction",
        "amount",
        "is_active_classification",
        "value_date",
        "created_at",
    )
    list_filter = ("is_active_classification",)
    search_fields = (
        "remarks",
        "bank_transaction__narration",
        "bank_transaction__utr_number",
    )
    readonly_fields = ("created_at",)
    date_hierarchy = "value_date"
    ordering = ("-created_at",)

    # Faster admin by avoiding N+1 on FK columns
    list_select_related = (
        "bank_transaction",
        "transaction_type",
        "cost_centre",
        "entity",
        "asset",
        "contract",
    )

    # Keep FK widgets lightweight in admin
    raw_id_fields = (
        "bank_transaction",
        "transaction_type",
        "cost_centre",
        "entity",
        "asset",
        "contract",
    )

    # Optional quality-of-life: reduce page size (uncomment if you like)
    # list_per_page = 50
