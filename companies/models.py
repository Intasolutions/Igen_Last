from django.db import models

class Company(models.Model):
    name = models.CharField(max_length=255, unique=True)
    pan = models.CharField(max_length=10, unique=True)
    gst = models.CharField(max_length=15, blank=True, null=True)
    mca = models.CharField(max_length=30, blank=True, null=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)  # Merged from friend's version

    def __str__(self):  # Corrected method name
        return self.name

class CompanyDocument(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='documents')
    file = models.FileField(upload_to='company_docs/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
