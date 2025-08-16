from django.contrib import admin
from .models import Property, PropertyDocument, PropertyKeyDate

@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ('name', 'company', 'purpose', 'status', 'expected_rent', 'expected_sale_price')
    search_fields = ('name', 'company__name')
    list_filter = ('purpose', 'status', 'company')

admin.site.register(PropertyDocument)
admin.site.register(PropertyKeyDate)
