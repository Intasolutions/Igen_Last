from django.contrib import admin
from .models import Contact

@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'type', 'phone', 'email', 'company', 'is_active', 'created_at')
    list_filter = ('type', 'is_active', 'created_at', 'stakeholder_types')
    search_fields = ('full_name', 'phone', 'email', 'pan', 'gst')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')

    def get_queryset(self, request):
        return super().get_queryset(request).order_by('-created_at')
