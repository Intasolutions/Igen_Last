from django.contrib import admin
from .models import Asset, AssetServiceDue, AssetDocument

class AssetServiceDueInline(admin.TabularInline):
    model = AssetServiceDue
    extra = 1
    show_change_link = True

class AssetDocumentInline(admin.TabularInline):
    model = AssetDocument
    extra = 1
    show_change_link = True

@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'company', 'property', 'project', 'category',
        'purchase_date', 'purchase_price', 'warranty_expiry', 'location', 'is_active'
    )
    list_filter = ('company', 'category', 'purchase_date', 'warranty_expiry', 'is_active')
    search_fields = ('name', 'category', 'location', 'company_name', 'projectname', 'property_name')
    inlines = [AssetServiceDueInline, AssetDocumentInline]
    readonly_fields = ('created_at',)
    fieldsets = (
        (None, {
            'fields': (
                'name', 'company', 'project', 'property', 'category',
                'purchase_date', 'purchase_price', 'warranty_expiry',
                'location', 'maintenance_frequency', 'notes', 'is_active', 'created_at'
            )
        }),
    )

@admin.register(AssetServiceDue)
class AssetServiceDueAdmin(admin.ModelAdmin):
    list_display = ('asset', 'due_date', 'description', 'completed', 'created_at')
    list_filter = ('completed', 'due_date')
    search_fields = ('asset__name', 'description')

@admin.register(AssetDocument)
class AssetDocumentAdmin(admin.ModelAdmin):
    list_display = ('asset', 'document', 'uploaded_at')  # 🔄 fixed 'file' ➝ 'document'
    search_fields = ('asset__name',)
    readonly_fields = ('uploaded_at',)
