import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'igen.settings')
django.setup()

from transaction_types.models import TransactionType
from cost_centres.models import CostCentre

print("--- ALL TRANSACTION TYPES ---")
for t in TransactionType.objects.all():
    cc_name = t.cost_centre.name if t.cost_centre else "No Cost Centre"
    print(f"Name: {t.name} | Cost Centre: {cc_name}")
