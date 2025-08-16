from django.db import models
from companies.models import Company

class Property(models.Model):
    PURPOSE_CHOICES = [
        ('rental', 'Rental'),
        ('sale', 'Sale'),
        ('care', 'Care'),
    ]
    STATUS_CHOICES = [
        ('vacant', 'Vacant'),
        ('occupied', 'Occupied'),
        ('sold', 'Sold'),
        ('not_for_rent', 'Not for Rent'),
    ]
    PROPERTY_TYPE_CHOICES = [
        ('apartment', 'Apartment'),
        ('villa', 'Villa'),
        ('plot', 'Plot'),
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='properties')
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    purpose = models.CharField(max_length=10, choices=PURPOSE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='vacant')
    is_active = models.BooleanField(default=True)

    config_bhk = models.PositiveIntegerField(null=True, blank=True)
    config_bathroom = models.PositiveIntegerField(null=True, blank=True)
    property_type = models.CharField(max_length=20, choices=PROPERTY_TYPE_CHOICES)
    build_up_area_sqft = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    land_area_cents = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    expected_rent = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    monthly_rent = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    lease_start_date = models.DateField(null=True, blank=True)
    lease_end_date = models.DateField(null=True, blank=True)
    next_inspection_date = models.DateField(null=True, blank=True)

    expected_sale_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    igen_service_charge = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=15, blank=True, null=True)
    state = models.CharField(max_length=100, default='Kerala', blank=True, null=True)
    country = models.CharField(max_length=100, default='India', blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.get_purpose_display()})"

class PropertyDocument(models.Model):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='documents')
    file_name = models.CharField(max_length=255)
    file_url = models.FileField(upload_to='property_docs/')
    uploaded_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Document: {self.file_name} - Property: {self.property.name}"

class PropertyKeyDate(models.Model):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='key_dates')
    date_label = models.CharField(max_length=255)
    due_date = models.DateField()
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Key Date: {self.date_label} - {self.due_date} - Property: {self.property.name}"