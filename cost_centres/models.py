from django.db import models
from companies.models import Company

class CostCentre(models.Model):
    cost_centre_id = models.AutoField(
        primary_key=True,
        help_text="Unique identifier for the cost centre"
    )

    DIRECTION_CHOICES = [
        ('Credit', 'Credit'),
        ('Debit', 'Debit'),
        ('Both', 'Both'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='cost_centres',
        help_text="Company this cost centre belongs to"
    )
    name = models.CharField(
        max_length=255,
        help_text="Descriptive name of the cost centre"
    )
    transaction_direction = models.CharField(
        max_length=10,
        choices=DIRECTION_CHOICES,
        default='Both',
        help_text="Allowed transaction direction: Credit, Debit, or Both"
    )
    notes = models.TextField(
        blank=True,
        help_text="Optional notes or description for the cost centre"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Soft delete flag; inactive cost centres are not shown in active listings"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when this cost centre was created"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when this cost centre was last updated"
    )

    class Meta:
        unique_together = ['company', 'name']
        verbose_name = "Cost Centre"
        verbose_name_plural = "Cost Centres"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.company.name} - {self.name} ({self.transaction_direction})"
