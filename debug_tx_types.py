from transaction_types.models import TransactionType
for t in TransactionType.objects.all():
    cc = t.cost_centre.name if t.cost_centre else "None"
    print(f"{t.name} ||| {cc}")
