import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'igen.settings')
django.setup()

from properties.models import Property

print("--- INSPECTION FIELDS ON PROPERTY ---")
for field in Property._meta.get_fields():
    if 'inspection' in field.name.lower():
        print(f"Field: {field.name}")
