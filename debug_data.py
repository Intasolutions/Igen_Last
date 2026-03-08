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
from cost_centres.models import CostCentre
from cash_ledger.models import CashLedgerRegister

m_start = date(2026, 3, 1)
m_end = date(2026, 3, 31)

print("Checking Bank Classifications for March 2026...")
bank_txns = Classification.objects.filter(
    is_active_classification=True,
    value_date__range=(m_start, m_end),
    bank_transaction__is_deleted=False
)
print(f"Total active bank classifications in range: {bank_txns.count()}")
for t in bank_txns:
    print(f"  ID: {t.classification_id}, CC: {t.cost_centre.name}, Amount: {t.amount}, Margin: {t.parsed_margin}")

print("\nChecking Cash Entries for March 2026...")
cash_txns = CashLedgerRegister.objects.filter(
    is_active=True,
    date__range=(m_start, m_end)
)
print(f"Total active cash entries in range: {cash_txns.count()}")
for c in cash_txns:
    print(f"  ID: {c.id}, CC: {c.cost_centre.name}, Amount: {c.amount}, Margin: {c.margin}")

print("\nCost Centres available:")
for cc in CostCentre.objects.all():
    print(f"  - {cc.name}")
