from django.db import models

# reports/models.py
from django.db import models

class TransactionLedgerCombined(models.Model):
    id = models.CharField(primary_key=True, max_length=64)  # <- MUST match view column type
    date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    cost_centre = models.ForeignKey('cost_centres.CostCentre', on_delete=models.DO_NOTHING)
    entity = models.ForeignKey('entities.Entity', on_delete=models.DO_NOTHING)
    transaction_type = models.ForeignKey('transaction_types.TransactionType', on_delete=models.DO_NOTHING)
    asset = models.ForeignKey('assets.Asset', null=True, blank=True, on_delete=models.DO_NOTHING)
    contract = models.ForeignKey('contracts.Contract', null=True, blank=True, on_delete=models.DO_NOTHING)
    remarks = models.TextField(null=True, blank=True)
    source = models.CharField(max_length=10, choices=[('BANK', 'BANK'), ('CASH', 'CASH')])
    company = models.ForeignKey('companies.Company', on_delete=models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'v_transaction_ledger_combined'
