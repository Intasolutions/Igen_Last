from django.contrib import admin
from .models import Property, PropertyDocument, PropertyKeyDate


class PropertyDocumentInline(admin.TabularInline):
    model = PropertyDocument
    extra = 0
    fields = ("file_name", "file_url", "uploaded_on")
    readonly_fields = ("uploaded_on",)


class PropertyKeyDateInline(admin.TabularInline):
    model = PropertyKeyDate
    extra = 0
    fields = ("date_label", "due_date", "remarks")


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    # Columns on the list page
    list_display = (
        "id",
        "name",
        "company",
        "purpose",
        "status",
        "is_active",
        "property_type",
        "location",
        "city",
        "landlord",
        "project_manager",   # NEW
        "tenant_contact",    # canonical tenant FK
        "monthly_rent",
        "expected_sale_price",
        "expected_price",
    )
    list_select_related = ("company", "landlord", "project_manager", "tenant_contact")
    list_filter = (
        "company",
        "purpose",
        "status",
        "is_active",
        "property_type",
        "city",
        "state",
        "gated_community",
    )
    search_fields = (
        "name",
        "location",
        "city",
        "address_line1",
        "address_line2",
        "remarks",
        "company__name",
        "landlord__full_name",
        "landlord__email",
        "project_manager__full_name",
        "project_manager__email",
        "tenant_contact__full_name",
        "tenant_contact__email",
    )
    ordering = ("-id",)

    # Show docs & key dates on the property edit page
    inlines = (PropertyDocumentInline, PropertyKeyDateInline)


@admin.register(PropertyDocument)
class PropertyDocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "property", "file_name", "file_url", "uploaded_on")
    list_select_related = ("property",)
    search_fields = ("file_name", "property__name", "property__company__name")
    ordering = ("-uploaded_on",)


@admin.register(PropertyKeyDate)
class PropertyKeyDateAdmin(admin.ModelAdmin):
    list_display = ("id", "property", "date_label", "due_date")
    list_select_related = ("property",)
    search_fields = ("date_label", "property__name", "property__company__name")
    ordering = ("due_date",)
