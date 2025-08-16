from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

STATUS_CHOICES = [
    ("Pending", "Pending"),
    ("Completed", "Completed"),
    ("Paid", "Paid"),
    ("Cancelled", "Cancelled")
]

class Contract(models.Model):
    vendor = models.ForeignKey("vendors.Vendor", on_delete=models.CASCADE)
    cost_centre = models.ForeignKey("cost_centres.CostCentre", on_delete=models.CASCADE)
    entity = models.ForeignKey("entities.Entity", on_delete=models.CASCADE)
    description = models.TextField()
    contract_date = models.DateField()
    start_date = models.DateField()
    end_date = models.DateField()
    document = models.FileField(upload_to="contracts/", null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_on = models.DateTimeField(auto_now_add=True)
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Contract with {self.vendor}"

class ContractMilestone(models.Model):
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="milestones")
    milestone_name = models.CharField(max_length=255)
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.milestone_name
