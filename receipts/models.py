from django.db import models
from companies.models import Company
from entities.models import Entity
from banks.models import BankAccount
from cost_centres.models import CostCentre
from transaction_types.models import TransactionType

class Receipt(models.Model):
    date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=255, unique=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    entity = models.ForeignKey(Entity, on_delete=models.SET_NULL, null=True, blank=True)
    bank = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, blank=True)
    transaction_type = models.ForeignKey(TransactionType, limit_choices_to={'direction': 'Credit'}, on_delete=models.CASCADE)
    cost_centre = models.ForeignKey(CostCentre, on_delete=models.SET_NULL, null=True, blank=True)
    gst_applicable = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    document = models.FileField(upload_to='receipt_docs/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.transaction_type:
            self.gst_applicable = self.transaction_type.gst_applicable
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Receipt {self.reference} - ₹{self.amount}"
