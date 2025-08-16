from django.db import models
from companies.models import Company
from properties.models import Property
from projects.models import Project
# NOTE: don't import Contact directly to avoid circular imports; use the string path.


class Entity(models.Model):
    ENTITY_TYPES = [
        ('Property', 'Property'),
        ('Project', 'Project'),
        ('Contact', 'Contact'),   # ✅ added
        ('Internal', 'Internal'),
    ]

    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='entities',
        help_text="Company this entity belongs to",
        null=True,
        blank=True,
    )
    name = models.CharField(
        max_length=255,
        help_text="Name of the entity",
    )
    entity_type = models.CharField(
        max_length=20,
        choices=ENTITY_TYPES,
        help_text="Entity type: Property, Project, Contact, or Internal",
    )

    linked_property = models.ForeignKey(
        Property,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Linked property if entity_type=Property",
    )
    linked_project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Linked project if entity_type=Project",
    )
    linked_contact = models.ForeignKey(               # ✅ added
        'contacts.Contact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Linked contact if entity_type=Contact",
    )

    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='Active',
        help_text="Entity status: Active or Inactive",
    )
    remarks = models.TextField(
        blank=True,
        help_text="Optional remarks about the entity",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the entity was created",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the entity was last updated",
    )

    class Meta:
        unique_together = ['company', 'name']
        verbose_name = "Entity"
        verbose_name_plural = "Entities"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.entity_type})"
