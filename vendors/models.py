import uuid
from django.db import models
from django.core.validators import RegexValidator
from companies.models import Company
from users.models import User  # Assumes User model has UUID as primary key

class Vendor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    vendor_name = models.CharField(max_length=255)

    vendor_type = models.CharField(max_length=50, choices=[
        ('Contractor', 'Contractor'),
        ('Supplier', 'Supplier'),
        ('Consultant', 'Consultant')
    ])

    pan_number = models.CharField(
        max_length=10,
        validators=[
            RegexValidator(
                regex=r'^[A-Z]{5}[0-9]{4}[A-Z]$',
                message="PAN must be a valid 10-character alphanumeric string (e.g. ABCDE1234F)"
            )
        ]
    )

    gst_number = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        validators=[
            RegexValidator(
                regex=r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
                message="GST must be a valid 15-character alphanumeric code"
            )
        ]
    )

    contact_person = models.CharField(max_length=255)

    phone_number = models.CharField(
        max_length=10,
        validators=[
            RegexValidator(
                regex=r'^\d{10}$',
                message="Phone must be a 10-digit number"
            )
        ]
    )

    email = models.EmailField(blank=True, null=True)
    bank_name = models.CharField(max_length=255)
    bank_account = models.CharField(max_length=30)

    ifsc_code = models.CharField(
        max_length=11,
        validators=[
            RegexValidator(
                regex=r'^[A-Z]{4}0[A-Z0-9]{6}$',
                message="IFSC must be 11 characters (e.g. HDFC0XXXXXX)"
            )
        ]
    )

    address = models.TextField()
    notes = models.TextField(blank=True, null=True)

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    created_on = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.vendor_name
