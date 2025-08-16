from django.db import migrations

VIEW_NAME = "v_transaction_ledger_combined"

CREATE_VIEW_SQL = r"""
CREATE VIEW v_transaction_ledger_combined AS

-- BANK (classified bank transactions only, non-deleted)
SELECT
    ('B:' || tc.classification_id::text)               AS id,        -- text PK (UUID prefixed)
    COALESCE(bt.transaction_date, tc.value_date)::date AS date,
    COALESCE(
        tc.amount,
        bt.signed_amount,
        CASE
            WHEN COALESCE(bt.debit_amount, 0) <> 0 THEN -1 * bt.debit_amount
            WHEN COALESCE(bt.credit_amount, 0) <> 0 THEN bt.credit_amount
            ELSE 0
        END
    )                                                  AS amount,
    tc.cost_centre_id                                   AS cost_centre_id,
    tc.entity_id                                        AS entity_id,
    tc.transaction_type_id                              AS transaction_type_id,
    tc.asset_id                                         AS asset_id,
    tc.contract_id                                      AS contract_id,
    tc.remarks                                          AS remarks,
    'BANK'::text                                        AS source,
    ba.company_id                                       AS company_id
FROM tx_classify_transactionclassification tc
JOIN bank_uploads_banktransaction bt
  ON bt.id = tc.bank_transaction_id
JOIN banks_bankaccount ba
  ON ba.id = bt.bank_account_id
WHERE COALESCE(tc.is_active_classification, TRUE) = TRUE
  AND COALESCE(bt.is_deleted, FALSE) = FALSE

UNION ALL

-- CASH (already signed)
SELECT
    ('C:' || c.id::text)                                AS id,       -- text PK (int prefixed)
    c.date::date                                        AS date,
    c.amount                                            AS amount,
    c.cost_centre_id                                    AS cost_centre_id,
    c.entity_id                                         AS entity_id,
    c.transaction_type_id                               AS transaction_type_id,
    c.asset_id                                          AS asset_id,
    c.contract_id                                       AS contract_id,
    c.remarks                                           AS remarks,
    'CASH'::text                                        AS source,
    c.company_id                                        AS company_id
FROM cash_ledger_cashledgerregister c;
"""

DROP_VIEW_SQL = f"DROP VIEW IF EXISTS {VIEW_NAME} CASCADE;"


class Migration(migrations.Migration):
    dependencies = [
        ("reports", "0004_auto_20250730_1941"),
    ]
    operations = [
        migrations.RunSQL(sql=DROP_VIEW_SQL, reverse_sql=DROP_VIEW_SQL),
        migrations.RunSQL(sql=CREATE_VIEW_SQL, reverse_sql=DROP_VIEW_SQL),
    ]
