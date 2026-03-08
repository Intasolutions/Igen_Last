import os
import django
import sys
from datetime import date
from decimal import Decimal

# Setup Django
sys.path.append(r'c:\Users\91811\OneDrive\Desktop\Igrn_final')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'igen.settings')
django.setup()

from tx_classify.models import Classification
from cash_ledger.models import CashLedgerRegister

print("Total Classifications in DB:", Classification.objects.all().count())
for t in Classification.objects.all()[:10]:
    print(f"  Date: {t.value_date}, CC: {t.cost_centre.name}, Amount: {t.amount}")

print("\nTotal Cash Entries in DB:", CashLedgerRegister.objects.all().count())
for c in CashLedgerRegister.objects.all()[:10]:
    print(f"  Date: {c.date}, CC: {c.cost_centre.name}, Amount: {c.amount}")
