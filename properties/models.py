from django.db import models
from companies.models import Company
from contacts.models import Contact


class Property(models.Model):
    # ---- Choices ----
    PURPOSE_CHOICES = [
        ("rental", "Rental"),
        ("sale", "Sale"),
        ("care", "Care"),
    ]

    STATUS_CHOICES = [
        ("vacant", "Vacant"),
        ("occupied", "Occupied"),
        ("under maintenance", "Under Maintenance"),
        ("owner occupied", "Owner Occupied"),
        ("tenant occupied", "Tenant Occupied"),
        ("sold", "Sold"),            # legacy
        ("not_for_rent", "Not for Rent"),  # legacy
    ]

    PROPERTY_TYPE_CHOICES = [
        ("apartment", "Apartment"),
        ("villa", "Villa"),
        ("plot", "Plot"),
        ("commercial", "Commercial"),
    ]

    # ---- Core ----
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="properties"
    )
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)

    purpose = models.CharField(
        max_length=10, choices=PURPOSE_CHOICES, null=True, blank=True
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="vacant", null=True, blank=True
    )
    is_active = models.BooleanField(default=True)

    # ---- Contacts ----
    landlord = models.ForeignKey(
        Contact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="landlord_properties",
    )

    # Optional: Project Manager (contact with stakeholder type "Project Manager")
    project_manager = models.ForeignKey(
        Contact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_properties",
    )

    # LEGACY text field (kept to avoid breaking existing rows / migrations)
    # NOTE: keep the same name "tenant" as your existing DB column (text)
    tenant = models.CharField(max_length=255, null=True, blank=True)

    # NEW: canonical tenant FK (nullable & optional)
    tenant_contact = models.ForeignKey(
        Contact,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenant_properties",
    )

    # ---- Configuration ----
    config_bhk = models.PositiveIntegerField(null=True, blank=True)
    config_bathroom = models.PositiveIntegerField(null=True, blank=True)

    property_type = models.CharField(
        max_length=20, choices=PROPERTY_TYPE_CHOICES, null=True, blank=True
    )

    build_up_area_sqft = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    land_area_cents = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )

    # ---- Rental / Lease ----
    expected_rent = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    monthly_rent = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    lease_start_date = models.DateField(null=True, blank=True)
    lease_end_date = models.DateField(null=True, blank=True)
    next_inspection_date = models.DateField(null=True, blank=True)

    # ---- Sale ----
    expected_sale_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True
    )

    # Neutral expected price
    expected_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True
    )

    # ---- Charges ----
    igen_service_charge = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    # ---- Type-specific extras ----
    balconies = models.PositiveIntegerField(null=True, blank=True)
    car_parks = models.PositiveIntegerField(null=True, blank=True)
    furnishing = models.CharField(
        max_length=10,
        choices=[("fully", "Fully"), ("semi", "Semi"), ("none", "None")],
        null=True,
        blank=True,
    )
    floor_height = models.PositiveIntegerField(
        null=True, blank=True, help_text="Height of floor (e.g., in feet)"
    )
    front_facing = models.CharField(max_length=50, null=True, blank=True)
    amenities = models.TextField(null=True, blank=True)
    highlight = models.TextField(null=True, blank=True)

    gated_community = models.BooleanField(default=False)
    approach_road_width = models.PositiveIntegerField(
        null=True, blank=True, help_text="Road width (e.g., in feet)"
    )

    # ---- Address ----
    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=15, blank=True, null=True)
    state = models.CharField(max_length=100, default="Kerala", blank=True, null=True)
    country = models.CharField(max_length=100, default="India", blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        try:
            purpose_display = self.get_purpose_display()
        except Exception:
            purpose_display = self.purpose or "-"
        return f"{self.name} ({purpose_display})"


class PropertyDocument(models.Model):
    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="documents"
    )
    file_name = models.CharField(max_length=255)
    file_url = models.FileField(upload_to="property_docs/")
    uploaded_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Document: {self.file_name} - Property: {self.property.name}"


class PropertyKeyDate(models.Model):
    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="key_dates"
    )
    date_label = models.CharField(max_length=255)
    due_date = models.DateField()
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Key Date: {self.date_label} - {self.due_date} - Property: {self.property.name}"
