# bank_uploads/models.py
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
import hashlib
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class ActiveTransactionManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class BankUploadBatch(models.Model):
    """
    One row per uploaded file (batch).
    Drives the 'Recent Uploads' table and lets us show filename & counts.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bank_account = models.ForeignKey(
        'banks.BankAccount',
        on_delete=models.CASCADE,
        related_name='bank_upload_batches'
    )
    file_name = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bank_upload_batches'
    )

    uploaded_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    errors_count = models.PositiveIntegerField(default=0)

    # validation flags captured at upload time
    balance_continuity_in_file = models.BooleanField(default=True)
    previous_ending_balance_match = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['bank_account', 'created_at']),
        ]

    def __str__(self):
        return f"Batch {self.id} | {self.file_name} | {self.uploaded_count} txns"


class BankTransaction(models.Model):
    bank_account = models.ForeignKey(
        'banks.BankAccount',
        on_delete=models.CASCADE,
        related_name='bank_upload_transactions'
    )

    # batch FK (enables easy annotations and clean cascades)
    upload_batch = models.ForeignKey(
        BankUploadBatch,
        on_delete=models.CASCADE,
        related_name='transactions',
        db_index=True,
    )

    transaction_date = models.DateField()
    narration = models.TextField()

    # raw columns as received
    credit_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    debit_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    balance_amount = models.DecimalField(max_digits=12, decimal_places=2)
    utr_number = models.CharField(max_length=100, null=True, blank=True)

    # normalized value for consistent logic
    signed_amount = models.DecimalField(max_digits=12, decimal_places=2)

    # stable dedupe key (per-account unique)
    dedupe_key = models.CharField(max_length=64, editable=False, db_index=True)

    source = models.CharField(max_length=10, default='BANK')
    created_at = models.DateTimeField(auto_now_add=True)

    # Soft delete support
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # Managers
    objects = ActiveTransactionManager()   # Excludes soft-deleted
    all_objects = models.Manager()         # Includes soft-deleted

    class Meta:
        ordering = ['-transaction_date', '-created_at']
        indexes = [
            models.Index(fields=['bank_account']),
            models.Index(fields=['bank_account', 'transaction_date']),
            models.Index(fields=['utr_number']),
        ]
        # Prevent duplicates per bank account (ignore soft-deleted rows)
        constraints = [
            models.UniqueConstraint(
                fields=['bank_account', 'dedupe_key'],
                condition=Q(is_deleted=False),
                name='uniq_txn_per_account_dedupekey_active'
            )
        ]

    # ---------- normalization helpers ----------
    @staticmethod
    def _q2(val: Decimal | None) -> Decimal:
        return (val or Decimal('0')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def _compute_signed_amount(self) -> Decimal:
        if self.credit_amount is not None:
            return self._q2(self.credit_amount)
        if self.debit_amount is not None:
            return self._q2(Decimal('0') - (self.debit_amount or Decimal('0')))
        return Decimal('0.00')

    def _norm_text(self, s: str | None) -> str:
        return " ".join((s or "").split()).lower()

    def _build_dedupe_key(self) -> str:
        payload = "|".join([
            self.transaction_date.isoformat(),
            self._norm_text(self.narration),
            format(self.signed_amount, "f"),
            self._norm_text(self.utr_number),
        ])
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    # ---------- soft delete helpers ----------
    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at'])

    # ---------- lifecycle ----------
    def save(self, *args, **kwargs):
        # keep normalized fields consistent
        self.signed_amount = self._compute_signed_amount()
        self.dedupe_key = self._build_dedupe_key()
        super().save(*args, **kwargs)

    def __str__(self):
        amt = self.credit_amount or self.debit_amount
        return f"{self.transaction_date} | {self.narration[:40]} | ₹{amt}"
