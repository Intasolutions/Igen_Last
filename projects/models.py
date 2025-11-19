from django.db import models
from companies.models import Company
from users.models import User
from contacts.models import Contact


class Project(models.Model):
    PROJECT_TYPE_CHOICES = [
        ('internal', 'Internal'),
        ('construction', 'Construction'),
        ('interior', 'Interior'),
    ]
    PROJECT_STATUS_CHOICES = [
        ('proposed', 'Proposed'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]

    name = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)

    project_type = models.CharField(max_length=50, choices=PROJECT_TYPE_CHOICES, default='internal')
    project_status = models.CharField(max_length=50, choices=PROJECT_STATUS_CHOICES, default='proposed')

    # Address
    landmark = models.CharField(max_length=255, blank=True)
    pincode = models.CharField(max_length=10, blank=True)
    city = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)

    # People
    stakeholders = models.ManyToManyField(Contact, related_name='projects_involved', blank=True)
    key_stakeholder = models.ForeignKey(
        Contact, on_delete=models.SET_NULL, null=True, blank=True, related_name='key_stakeholder_projects'
    )

    expected_return = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)

    property_manager = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        limit_choices_to={'role': 'PROPERTY_MANAGER'}, related_name='projects_managed'
    )

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='projects')

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ProjectKeyDate(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='key_dates')
    label = models.CharField(max_length=255)
    due_date = models.DateField()
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.label} - {self.project.name}"


# NEW: Project Milestones
class ProjectMilestone(models.Model):
    STATUS_CHOICES = [
        ('planned', 'Planned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('blocked', 'Blocked'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='milestones')
    name = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.project.name})"


class Property(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('sold', 'Sold'),
        ('inactive', 'Inactive'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='properties')
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=512, blank=True)
    purchase_date = models.DateField()
    purchase_price = models.DecimalField(max_digits=15, decimal_places=2)
    expected_rent = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.project.name})"
