from django.contrib import admin
from .models import Vendor

@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = (
        'vendor_name', 'vendor_type', 'contact_person', 'phone_number',
        'email', 'company', 'created_by', 'created_on'
    )
    list_filter = ('vendor_type', 'company', 'created_on')
    search_fields = (
        'vendor_name', 'contact_person', 'phone_number', 'email',
        'pan_number', 'gst_number', 'bank_account', 'ifsc_code'
    )
    readonly_fields = ('created_on',)
    fieldsets = (
        ('Vendor Details', {
            'fields': (
                'vendor_name', 'vendor_type', 'pan_number', 'gst_number',
                'contact_person', 'phone_number', 'email'
            )
        }),
        ('Bank Information', {
            'fields': ('bank_name', 'bank_account', 'ifsc_code')
        }),
        ('Other Info', {
            'fields': ('address', 'notes')
        }),
        ('Metadata', {
            'fields': ('company', 'created_by', 'created_on')
        }),
    )
