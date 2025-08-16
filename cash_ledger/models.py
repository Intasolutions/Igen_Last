# cash_ledger/models.py

from django.db import models
from companies.models import Company
from cost_centres.models import CostCentre
from entities.models import Entity
from transaction_types.models import TransactionType
from assets.models import Asset
from contracts.models import Contract
from users.models import User

class CashLedgerRegister(models.Model):
    id = models.AutoField(primary_key=True)
    date = models.DateField()
    spent_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    cost_centre = models.ForeignKey(CostCentre, on_delete=models.CASCADE)
    entity = models.ForeignKey(Entity, on_delete=models.CASCADE)
    transaction_type = models.ForeignKey(TransactionType, on_delete=models.CASCADE)
    asset = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL)
    contract = models.ForeignKey(Contract, null=True, blank=True, on_delete=models.SET_NULL)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    chargeable = models.BooleanField(default=False)
    margin = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    remarks = models.TextField(blank=True, null=True)
    balance_amount = models.DecimalField(max_digits=12, decimal_places=2)
    document = models.FileField(upload_to='cash_ledger_docs/', null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="created_cash_entries")
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True) 

    def __str__(self):
        return f"Cash Entry on {self.date} - ₹{self.amount}"
