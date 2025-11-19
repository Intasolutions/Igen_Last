# tx_classify/models.py
from __future__ import annotations

import re
import uuid
from decimal import Decimal, InvalidOperation
from django.db import models

from bank_uploads.models import BankTransaction
from transaction_types.models import TransactionType
from cost_centres.models import CostCentre
from entities.models import Entity
from assets.models import Asset
from contracts.models import Contract


class Classification(models.Model):
    """
    Mirrors EXISTING table: tx_classify_transactionclassification
    DO NOT MIGRATE this model; we just map columns correctly.
    """

    # PK in DB is UUID named classification_id (NOT NULL)
    classification_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        db_column="classification_id",
    )

    # Required FKs in your table (NOT NULL)
    bank_transaction = models.ForeignKey(
        BankTransaction,
        on_delete=models.CASCADE,
        related_name="classifications",
        db_column="bank_transaction_id",
        db_index=True,
    )
    transaction_type = models.ForeignKey(
        TransactionType,
        on_delete=models.PROTECT,
        db_column="transaction_type_id",
    )
    cost_centre = models.ForeignKey(
        CostCentre,
        on_delete=models.PROTECT,
        db_column="cost_centre_id",
    )
    entity = models.ForeignKey(
        Entity,
        on_delete=models.PROTECT,
        db_column="entity_id",
    )

    # Optional FKs in your table (NULLABLE)
    asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="asset_id",
    )
    contract = models.ForeignKey(
        Contract,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="contract_id",
    )

    amount = models.DecimalField(max_digits=14, decimal_places=2)
    value_date = models.DateField()
    remarks = models.TextField(null=True, blank=True)
    is_active_classification = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tx_classify_transactionclassification"
        # managed = False  # Do not run migrations against this table
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["bank_transaction"]),
            models.Index(fields=["is_active_classification"]),
        ]

    def __str__(self) -> str:
        return f"{self.classification_id} | tx={self.bank_transaction_id} | ₹{self.amount}"

    # ---- Derived helpers ----
    @property
    def parsed_margin(self) -> Decimal | None:
        """
        Extract 'Margin: <amount>' from remarks text if present.
        Returns a Decimal or None.
        """
        if not self.remarks:
            return None
        match = re.search(r"Margin:\s*([0-9]+(?:\.[0-9]{1,2})?)", self.remarks)
        if not match:
            return None
        try:
            return Decimal(match.group(1))
        except InvalidOperation:
            return None

    @property
    def cleaned_remarks(self) -> str | None:
        """
        Return remarks text with any 'Margin: ...' note removed.
        """
        if not self.remarks:
            return None
        return re.sub(r"\s*\|?\s*Margin:\s*[0-9]+(?:\.[0-9]{1,2})?", "", self.remarks).strip() or None
