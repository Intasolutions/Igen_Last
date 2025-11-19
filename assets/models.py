from django.db import models
from companies.models import Company
from properties.models import Property
from projects.models import Project
from entities.models import Entity  # NEW


class Asset(models.Model):
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='assets',
        help_text="Company that owns this asset"
    )
    property = models.ForeignKey(
        Property, on_delete=models.SET_NULL, null=True, blank=True, related_name='assets',
        help_text="Linked property, if applicable"
    )
    project = models.ForeignKey(
        Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='assets',
        help_text="Linked project, if applicable"
    )
    entity = models.ForeignKey(  # NEW
        Entity, on_delete=models.SET_NULL, null=True, blank=True, related_name='assets',
        help_text="Linked entity, if applicable"
    )

    name = models.CharField(max_length=255, help_text="Asset name")
    category = models.CharField(max_length=255, help_text="Asset category")
    purchase_date = models.DateField(help_text="Date of purchase")
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, help_text="Purchase price")
    warranty_expiry = models.DateField(null=True, blank=True, help_text="Warranty expiration date")
    location = models.CharField(max_length=255, help_text="Physical location of the asset")
    maintenance_frequency = models.CharField(max_length=255, help_text="Frequency of maintenance (e.g., monthly)")
    notes = models.TextField(blank=True, help_text="Additional notes about the asset")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, help_text="Timestamp when asset was created")
    tag_id = models.CharField(
        max_length=100, blank=True, null=True,
        db_index=True, help_text="Unique tag ID (barcode/RFID)"
    )

    def _str_(self):  # fixed dunder
        return f"{self.name} ({self.tag_id or 'No Tag'})"

    class Meta:
        verbose_name = "Asset"
        verbose_name_plural = "Assets"
        ordering = ['-created_at']


class AssetServiceDue(models.Model):
    asset = models.ForeignKey(
        Asset, on_delete=models.CASCADE, related_name='service_dues',
        help_text="Linked asset for this service due"
    )
    due_date = models.DateField(help_text="Date when service is due")
    description = models.CharField(max_length=255, help_text="Service description")
    completed = models.BooleanField(default=False, help_text="Mark if the service was completed")
    created_at = models.DateTimeField(auto_now_add=True, help_text="Timestamp when this service due was created")

    def _str_(self):  # fixed dunder
        return f"{self.asset.name} - Due on {self.due_date}"

    class Meta:
        verbose_name = "Asset Service Due"
        verbose_name_plural = "Asset Service Dues"


class AssetDocument(models.Model):
    asset = models.ForeignKey(
        Asset, on_delete=models.CASCADE, related_name='documents',
        help_text="Linked asset for this document"
    )
    document = models.FileField(upload_to='asset_docs/', help_text="Uploaded document file")
    uploaded_at = models.DateTimeField(auto_now_add=True, help_text="Timestamp when document was uploaded")

    def _str_(self):  # fixed dunder
        return f"Document for {self.asset.name}"

    class Meta:
        verbose_name = "Asset Document"
        verbose_name_plural = "Asset Documents"


