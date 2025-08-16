from django.db import models
from companies.models import Company

class BankAccount(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='bank_accounts')
    account_name = models.CharField(max_length=255)
    account_number = models.CharField(max_length=30, unique=True)
    bank_name = models.CharField(max_length=255)
    ifsc = models.CharField(max_length=11)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.company.name} - {self.account_name} ({self.account_number})"
