from django.db import migrations

def set_flag(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.all().update(must_reset_password=False)

class Migration(migrations.Migration):
    dependencies = [
        ("users", "0004_user_must_reset_password_user_password_changed_at_and_more"),
    ]
    operations = [
        migrations.RunPython(set_flag, migrations.RunPython.noop),
    ]
