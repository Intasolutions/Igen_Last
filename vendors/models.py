import uuid
from django.db import models
from django.core.validators import RegexValidator
from companies.models import Company
from users.models import User  # Assumes User model has UUID as primary key


class Vendor(models.Model):
    class VendorType(models.TextChoices):
        CONTRACTOR = "Contractor", "Contractor"
        SUPPLIER = "Supplier", "Supplier"
        CONSULTANT = "Consultant", "Consultant"

    class PaymentMethod(models.TextChoices):
        BANK = "BANK", "Bank"
        UPI = "UPI", "UPI"
        WALLET = "WALLET", "Wallet"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Required
    vendor_name = models.CharField(max_length=255)

    # Required
    vendor_type = models.CharField(
        max_length=50,
        choices=VendorType.choices,
    )

    # Optional
    contact_person = models.CharField(max_length=255, blank=True, null=True)

    # Required (client did NOT mark this as optional)
    phone_number = models.CharField(
        max_length=10,
        validators=[
            RegexValidator(
                regex=r'^\d{10}$',
                message="Phone must be a 10-digit number",
            )
        ],
    )

    # Optional
    email = models.EmailField(blank=True, null=True)

    # Payment method selector (default to Bank). All related details are optional.
    payment_method = models.CharField(
        max_length=10,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK,
    )

    # Bank details (all optional)
    bank_name = models.CharField(max_length=255, blank=True, null=True)
    bank_account = models.CharField(max_length=30, blank=True, null=True)
    ifsc_code = models.CharField(
        max_length=11,
        blank=True,
        null=True,
        validators=[
            RegexValidator(
                regex=r'^[A-Z]{4}0[A-Z0-9]{6}$',
                message="IFSC must be 11 characters (e.g. HDFC0XXXXXX)",
            )
        ],
    )

    # UPI / Wallet details (optional)
    upi_id = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. name@bank")
    gpay_number = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        validators=[
            RegexValidator(
                regex=r'^\d{10}$',
                message="GPay number must be a 10-digit number",
            )
        ],
    )

    # Optional
    pan_number = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        validators=[
            RegexValidator(
                regex=r'^[A-Z]{5}[0-9]{4}[A-Z]$',
                message="PAN must be a valid 10-character alphanumeric string (e.g. ABCDE1234F)",
            )
        ],
    )

    # Optional (already)
    gst_number = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        validators=[
            RegexValidator(
                regex=r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
                message="GST must be a valid 15-character alphanumeric code",
            )
        ],
    )

    # Optional
    address = models.TextField(blank=True, null=True)

    # Optional
    notes = models.TextField(blank=True, null=True)

    # Required
    company = models.ForeignKey(Company, on_delete=models.CASCADE)

    # Optional
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    created_on = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.vendor_name

