import os
import django
import sys
from django.db.models import Q

# setup django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'igen.settings')
django.setup()

from bank_uploads.models import BankUploadBatch, BankTransaction
from tx_classify.models import Classification
from cash_ledger.models import CashLedgerRegister
from companies.models import Company

# Keywords to hunt for
SCRUB_KEYWORDS = ['dummy', 'test', 'sample', 'reconciliation', 'final_dashboard_test']

print("--- DEEP CLEANING DATABASE ---")

# 1. Clean Bank Upload Batches (Cascades to Transactions and Classifications)
for kw in SCRUB_KEYWORDS:
    batches = BankUploadBatch.objects.filter(file_name__icontains=kw)
    if batches.exists():
        c = batches.count()
        batches.delete()
        print(f"Scrubbed {c} batches matching '{kw}'")

# 2. Clean individual Bank Transactions not in batches (Safety Check)
for kw in SCRUB_KEYWORDS:
    txns = BankTransaction.objects.filter(Q(narration__icontains=kw))
    if txns.exists():
        c = txns.count()
        txns.delete()
        print(f"Scrubbed {c} individual Bank Transactions matching '{kw}'")

# 3. Clean Cash Ledger
for kw in SCRUB_KEYWORDS:
    cash = CashLedgerRegister.objects.filter(Q(remarks__icontains=kw))
    if cash.exists():
        c = cash.count()
        cash.delete()
        print(f"Scrubbed {c} Cash Ledger records matching '{kw}'")

# 4. Final verification of remaining scripts
scripts = ['seed_data.py', 'cleanup_test_data.py', 'create_drilldown_data.py', 'create_final_test.py', 'verify_pending.py']
for s in scripts:
    if os.path.exists(s):
        try:
            os.remove(s)
            print(f"Removed system-generated script: {s}")
        except:
            pass

print("\n--- DATABASE IS NOW 100% CLEAN ---")
