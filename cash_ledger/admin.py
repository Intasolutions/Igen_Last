from django.contrib import admin, messages
from .models import CashLedgerRegister

@admin.register(CashLedgerRegister)
class CashLedgerRegisterAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'date', 'company', 'spent_by', 'cost_centre', 'entity',
        'transaction_type', 'amount', 'chargeable', 'margin',
        'balance_amount', 'is_active', 'created_on'
    )
    list_filter = ('is_active', 'company', 'cost_centre', 'entity', 'transaction_type', 'chargeable')
    search_fields = ('remarks', 'spent_by__full_name', 'entity__name', 'cost_centre__name')
    readonly_fields = ('created_on', 'balance_amount')
    list_per_page = 25

    # Custom actions
    actions = [
        'soft_delete_selected',
        'activate_entries',
        'deactivate_entries',
        'hard_delete_selected',   # <-- keep if you want true deletion
    ]

    # Default list shows only active unless filter explicitly set
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # If the "is_active" filter is used, respect it; otherwise show only active
        if 'is_active__exact' in request.GET:
            return qs
        return qs.filter(is_active=True)

    # Remove Django's built-in "delete_selected" (confusing success message)
    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop('delete_selected', None)
        return actions

    # Keep Delete button visible on object page, but make it do a SOFT delete
    def has_delete_permission(self, request, obj=None):
        return True

    def delete_model(self, request, obj):
        if obj.is_active:
            obj.is_active = False
            obj.save(update_fields=['is_active'])
            self.message_user(request, "Entry marked Inactive (soft deleted).", messages.INFO)
        else:
            self.message_user(request, "Entry is already Inactive.", messages.WARNING)

    # When something triggers a queryset delete (rare now), still soft delete
    def delete_queryset(self, request, queryset):
        updated = queryset.exclude(is_active=False).update(is_active=False)
        self.message_user(request, f"{updated} entries marked Inactive (soft deleted).", messages.INFO)

    @admin.action(description="Soft delete selected (mark Inactive)")
    def soft_delete_selected(self, request, queryset):
        updated = queryset.exclude(is_active=False).update(is_active=False)
        self.message_user(request, f"{updated} entries marked Inactive.", messages.SUCCESS)

    @admin.action(description="Mark selected entries as Active")
    def activate_entries(self, request, queryset):
        updated = queryset.exclude(is_active=True).update(is_active=True)
        self.message_user(request, f"{updated} entries activated.", messages.SUCCESS)

    @admin.action(description="Mark selected entries as Inactive")
    def deactivate_entries(self, request, queryset):
        updated = queryset.exclude(is_active=False).update(is_active=False)
        self.message_user(request, f"{updated} entries deactivated.", messages.SUCCESS)

    @admin.action(description="HARD delete selected (permanent)")
    def hard_delete_selected(self, request, queryset):
        count = queryset.count()
        queryset.delete()
        self.message_user(request, f"Permanently deleted {count} entries.", messages.WARNING)
