from django.contrib import admin
from .models import BankAccount

class BankAccountAdmin(admin.ModelAdmin):
    list_display = ['company', 'account_name', 'account_number', 'bank_name', 'ifsc', 'is_active', 'created_at']
    search_fields = ['account_name', 'account_number', 'bank_name', 'ifsc']
    list_filter = ['company', 'is_active']

admin.site.register(BankAccount, BankAccountAdmin)
