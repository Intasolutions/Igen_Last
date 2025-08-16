from django.contrib import admin
from .models import Company, CompanyDocument

class CompanyDocumentInline(admin.TabularInline):
    model = CompanyDocument
    extra = 0
    readonly_fields = ('uploaded_at',)
    can_delete = True

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'pan', 'gst', 'mca', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'pan', 'gst', 'mca')
    ordering = ('-created_at',)
    inlines = [CompanyDocumentInline]
    readonly_fields = ('created_at',)

@admin.register(CompanyDocument)
class CompanyDocumentAdmin(admin.ModelAdmin):
    list_display = ('company', 'file', 'uploaded_at')
    search_fields = ('company__name',)
    list_filter = ('uploaded_at',)
    ordering = ('-uploaded_at',)
