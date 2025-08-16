from django.contrib import admin
from .models import Entity

@admin.register(Entity)
class EntityAdmin(admin.ModelAdmin):
    list_display = ('name', 'company', 'entity_type', 'status', 'created_at')
    list_filter = ('status', 'entity_type', 'company')
    search_fields = ('name', 'company__name')
    ordering = ('-created_at',)
