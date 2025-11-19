import uuid
from django.db import models
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
from companies.models import Company
from django.contrib.auth import get_user_model

User = get_user_model()

class Contact(models.Model):
    INDIVIDUAL = 'Individual'
    COMPANY = 'Company'

    TYPE_CHOICES = [
        (INDIVIDUAL, 'Individual'),
        (COMPANY, 'Company'),
    ]

    STAKEHOLDER_TYPES = [
        ('Landlord', 'Landlord'),
        ('Tenant', 'Tenant'),
        ('Vendor', 'Vendor'),
        ('Buyer', 'Buyer'),
        ('Seller', 'Seller'),
        ('Broker', 'Broker'),
        ('Key Holder', 'Key Holder'),
        ('Project Stakeholder', 'Project Stakeholder'),
        ('Project Manager', 'Project Manager'),
        ('Other', 'Other'),
    ]

    contact_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=INDIVIDUAL)
    stakeholder_types = models.JSONField(default=list)

    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        related_name='contacts',
        null=True,
        blank=True
    )

    phone = models.CharField(
        max_length=20,
        unique=True,  # enforce uniqueness at DB level
        error_messages={
            'unique': 'This mobile number is already in use.'  # friendly message
        },
        validators=[
            RegexValidator(
                regex=r'^\+?[0-9\s\-]{7,20}$',
                message='Enter a valid phone number (7–20 digits, may include +, space, -)'
            )
        ]
    )
    alternate_phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    address = models.TextField(blank=True, null=True)

    # PAN is NON-MANDATORY
    # (optional: keep unique so if provided it doesn't duplicate)
    pan = models.CharField(max_length=15, unique=True, blank=True, null=True)

    gst = models.CharField(max_length=25, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    # Optional location fields
    landmark = models.CharField(max_length=255, blank=True, null=True)
    pincode = models.CharField(max_length=10, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    district = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, default='Kerala')
    country = models.CharField(max_length=100, default='India')

    # Relationships
    linked_properties = models.ManyToManyField('properties.Property', blank=True)

    # Audit info
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def clean(self):
        # Require GST only for Company contacts
        if self.type == self.COMPANY and not self.gst:
            raise ValidationError({'gst': 'GST number is required for contacts of type Company.'})

        # At least one stakeholder type
        if not self.stakeholder_types:
            raise ValidationError({'stakeholder_types': 'At least one stakeholder type must be selected.'})

        # PAN stays optional; no requirement here

    def __str__(self):
        return self.full_name
