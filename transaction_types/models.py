from django.db import models
from companies.models import Company
from cost_centres.models import CostCentre


class TransactionType(models.Model):
    DIRECTION_CHOICES = [
        ("Credit", "Credit"),
        ("Debit", "Debit"),
    ]

    STATUS_CHOICES = [
        ("Active", "Active"),
        ("Inactive", "Inactive"),
    ]

    transaction_type_id = models.AutoField(
        primary_key=True,
        help_text="Unique identifier for the transaction type",
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="transaction_types",
    )
    cost_centre = models.ForeignKey(
        CostCentre,
        on_delete=models.CASCADE,
        related_name="transaction_types",
        help_text="Cost centre linked to this transaction type",
        null=True,   # allow null temporarily for existing records
        blank=True,
    )
    name = models.CharField(
        max_length=255,
        help_text="Descriptive name of the transaction type",
    )
    direction = models.CharField(
        max_length=10,
        choices=DIRECTION_CHOICES,
        default="Credit",  # sensible default for existing rows
        help_text="Transaction direction: Credit or Debit",
    )
    gst_applicable = models.BooleanField(
        default=False,
        help_text="Whether GST is applicable for this transaction type",
    )
    # ✅ NEW: Margin Applicable flag (requested)
    margin_applicable = models.BooleanField(
        default=False,
        help_text="Whether margin is applicable for this transaction type",
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="Active",
        help_text="Status of the transaction type: Active or Inactive",
    )
    is_credit = models.BooleanField(default=False)
    remarks = models.TextField(
        blank=True,
        help_text="Optional remarks about the transaction type",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the transaction type was created",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the transaction type was last updated",
    )

    class Meta:
        unique_together = ["company", "name"]
        verbose_name = "Transaction Type"
        verbose_name_plural = "Transaction Types"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.company.name} - {self.name} ({self.direction})"
