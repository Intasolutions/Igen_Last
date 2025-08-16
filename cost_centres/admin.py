from django.contrib import admin
from .models import CostCentre

@admin.register(CostCentre)
class CostCentreAdmin(admin.ModelAdmin):
    list_display = ('cost_centre_id', 'company', 'name', 'transaction_direction', 'is_active', 'created_at')
    list_filter = ('transaction_direction', 'is_active', 'company')
    search_fields = ('name', 'company__name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')
