from django.db import migrations
import os
USE_SQLITE = os.environ.get("USE_SQLITE", "False").lower() in ("true", "1", "yes")

class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0003_alter_transactionledgercombined_options'),  # change this to match your previous migration
    ]

    operations = [
    ]

    if not USE_SQLITE:
        operations.append(
            migrations.RunSQL(
                """
                CREATE OR REPLACE VIEW v_transaction_ledger_combined AS
                SELECT
                    ct.value_date AS date,
                    ct.amount,
                    ct.cost_centre_id,
                    ct.entity_id,
                    ct.transaction_type_id,
                    ct.asset_id,
                    ct.contract_id,
                    ct.remarks,
                    'BANK' AS source,
                    ct.company_id
                FROM classified_transactions ct
                WHERE ct.is_active_classification = TRUE

                UNION ALL

                SELECT
                    clr.date,
                    clr.amount,
                    clr.cost_centre_id,
                    clr.entity_id,
                    clr.transaction_type_id,
                    clr.asset_id,
                    clr.contract_id,
                    clr.remarks,
                    'CASH' AS source,
                    clr.company_id
                FROM cash_ledger_register clr
                WHERE clr.is_active = TRUE;
                """,
                reverse_sql="DROP VIEW IF EXISTS v_transaction_ledger_combined;"
            )
        )
