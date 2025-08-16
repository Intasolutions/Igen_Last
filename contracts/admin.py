from django.contrib import admin
from .models import Contract, ContractMilestone

class ContractMilestoneInline(admin.TabularInline):
    model = ContractMilestone
    extra = 0
    readonly_fields = ('milestone_name', 'due_date', 'amount', 'status', 'remarks')
    can_delete = False

@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ('vendor', 'contract_date', 'start_date', 'end_date', 'company', 'is_active', 'created_on')
    list_filter = ('is_active', 'contract_date', 'company', 'vendor')
    search_fields = ('description', 'vendor__vendor_name', 'company__name')
    ordering = ('-created_on',)
    inlines = [ContractMilestoneInline]
    readonly_fields = ('created_on',)

@admin.register(ContractMilestone)
class ContractMilestoneAdmin(admin.ModelAdmin):
    list_display = ('contract', 'milestone_name', 'due_date', 'amount', 'status')
    list_filter = ('status', 'due_date')
    search_fields = ('milestone_name', 'contract__vendor__vendor_name')
