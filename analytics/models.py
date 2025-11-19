from django.db import models

# Create your models here.


class OwnerRentalFlag(models.Model):
    property = models.OneToOneField(
        'properties.Property',
        on_delete=models.CASCADE,
        related_name='owner_flags'
    )
    transaction_scheduled = models.BooleanField(default=False)
    email_sent = models.BooleanField(default=False)

    def __str__(self):
        return f"Flags<{self.property_id}> txn:{self.transaction_scheduled} email:{self.email_sent}"
