# reports/models.py
from django.db import models


class TransactionLedgerCombined(models.Model):
    class Source(models.TextChoices):
        BANK = "BANK", "BANK"
        CASH = "CASH", "CASH"

    # NOTE: This must match the SQL VIEW column type & uniqueness
    id = models.CharField(primary_key=True, max_length=64)

    # Core fields
    date = models.DateField(db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    # Foreign keys (read-only view → DO_NOTHING + no reverse relations)
    cost_centre = models.ForeignKey(
        "cost_centres.CostCentre",
        on_delete=models.DO_NOTHING,
        related_name="+",
    )
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.DO_NOTHING,
        related_name="+",
        db_index=True,
    )
    transaction_type = models.ForeignKey(
        "transaction_types.TransactionType",
        on_delete=models.DO_NOTHING,
        related_name="+",
    )
    asset = models.ForeignKey(
        "assets.Asset",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        related_name="+",
    )
    contract = models.ForeignKey(
        "contracts.Contract",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        related_name="+",
    )

    # Misc
    remarks = models.TextField(null=True, blank=True)
    source = models.CharField(max_length=10, choices=Source.choices, db_index=True)

    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.DO_NOTHING,
        related_name="+",
        db_index=True,
    )

    class Meta:
        managed = False  # this is a DB VIEW
        db_table = "v_transaction_ledger_combined_v2"  # ← use the fixed view
        ordering = ("-date", "-id")
        # Speed up common filters: company/date/entity/source
        indexes = [
            models.Index(fields=("company", "date")),
            models.Index(fields=("company", "entity")),
            models.Index(fields=("company", "source")),
            models.Index(fields=("date", "entity")),
        ]
        # This model is read-only; avoid creating extra permissions
        default_permissions = ()

    def __str__(self):
        return f"{self.date} | {self.source} | {self.amount} | entity={self.entity_id}"
