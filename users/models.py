from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db.models.functions import Lower
from companies.models import Company

# >>> ADDED: imports for reset tokens and timestamps
from django.utils import timezone  # >>> ADDED
import secrets  # >>> ADDED


# ---------- Soft delete helpers ----------
class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        # queryset-level soft delete
        return super().update(is_deleted=True)

    def hard_delete(self):
        # permanently delete from DB
        return super().delete()

    def alive(self):
        return self.filter(is_deleted=False)

    def dead(self):
        return self.filter(is_deleted=True)


class SoftDeleteUserManager(BaseUserManager):
    """
    Default manager: returns only non-deleted users.
    Includes create_user/create_superuser to keep Django's createsuperuser flow working.
    """
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()

    def create_user(self, user_id, password=None, **extra_fields):
        if not user_id:
            raise ValueError("Users must have a user_id")
        user = self.model(user_id=user_id, **extra_fields)
        if password:
            user.set_password(password)
        else:
            # allow external provisioning; still enforce a hashed pw
            user.set_unusable_password()
        # >>> ADDED: new-user default is handled by model default (must_reset_password=True)
        user.save(using=self._db)
        return user

    def create_superuser(self, user_id, password=None, **extra_fields):
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_staff", True)
        return self.create_user(user_id, password, **extra_fields)


class AllUsersManager(BaseUserManager):
    """
    Secondary manager: returns ALL users (including soft-deleted).
    Useful for admin/maintenance tasks.
    """
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

    # Keep create methods here too so admin scripts can use all_objects.create_*
    def create_user(self, user_id, password=None, **extra_fields):
        if not user_id:
            raise ValueError("Users must have a user_id")
        user = self.model(user_id=user_id, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, user_id, password=None, **extra_fields):
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_staff", True)
        return self.create_user(user_id, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ("SUPER_USER", "Super User"),
        ("CENTER_HEAD", "Center Head"),
        ("ACCOUNTANT", "Accountant"),
        ("PROPERTY_MANAGER", "Property Manager"),
    ]

    # Auth + identity
    user_id = models.CharField(max_length=50, unique=True, db_index=True)
    full_name = models.CharField(max_length=255)

    # Optional email (JWT serializer supports login via email)
    # Keep unique on LOWER(email) to avoid case duplicates in Postgres.
    email = models.EmailField(null=True, blank=True, unique=False)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="ACCOUNTANT")

    # Django flags
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    # Soft delete flag
    is_deleted = models.BooleanField(default=False, db_index=True)

    # Optional: assign user to one or more companies
    companies = models.ManyToManyField(Company, blank=True, related_name="users")

    # >>> ADDED: first-login enforcement + audit of password changes
    must_reset_password = models.BooleanField(default=True)  # force reset on first login  # >>> ADDED
    password_changed_at = models.DateTimeField(null=True, blank=True)  # >>> ADDED

    USERNAME_FIELD = "user_id"
    REQUIRED_FIELDS: list[str] = []  # keep empty since we authenticate via user_id

    # Managers
    objects = SoftDeleteUserManager()   # default: excludes soft-deleted
    all_objects = AllUsersManager()     # includes soft-deleted

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # Enforce case-insensitive uniqueness for email when present.
            # Postgres only. If using MySQL/SQLite, remove this constraint.
            models.UniqueConstraint(
                Lower("email"),
                name="uniq_user_email_lower",
                condition=models.Q(email__isnull=False),
            ),
        ]
        indexes = [
            models.Index(fields=["role"], name="idx_user_role"),
            models.Index(fields=["user_id"], name="idx_user_userid"),
            models.Index(fields=["created_at"], name="idx_user_created_at"),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.user_id})"

    # Normalize email for consistency
    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    # Instance-level soft delete API
    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.save(update_fields=["is_deleted"])

    def hard_delete(self, using=None, keep_parents=False):
        super(User, self).delete(using=using, keep_parents=keep_parents)

    def restore(self):
        if self.is_deleted:
            self.is_deleted = False
            self.save(update_fields=["is_deleted"])

    # Convenience for code that needs a primary company (your JWT uses first())
    @property
    def primary_company_id(self):
        if self.role == "SUPER_USER":
            return None
        first = self.companies.first()
        return first.id if first else None


# >>> ADDED: reset-token model for "Forgot password" flow
class PasswordReset(models.Model):
    """
    One-time password reset token.
    - Issue with PasswordReset.issue(user) which returns a new token row.
    - Validate: not used and not expired.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_resets")
    token = models.CharField(max_length=128, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)  # helpful for debug/audit  # >>> ADDED

    class Meta:
        indexes = [
            models.Index(fields=["expires_at"], name="idx_pwreset_expires_at"),  # >>> ADDED
            models.Index(fields=["used"], name="idx_pwreset_used"),               # >>> ADDED
        ]

    def __str__(self):
        return f"PasswordReset(user={self.user_id_display}, used={self.used})"

    @property
    def user_id_display(self):
        try:
            return getattr(self.user, "user_id", self.user_id)
        except Exception:
            return None

    @staticmethod
    def issue(user, ttl_minutes: int = 30):
        """
        Create and return a fresh token valid for `ttl_minutes`.
        """
        return PasswordReset.objects.create(
            user=user,
            token=secrets.token_urlsafe(32),
            expires_at=timezone.now() + timezone.timedelta(minutes=ttl_minutes),
        )

    # Convenience checks
    def is_expired(self) -> bool:
        return self.expires_at < timezone.now()

    def mark_used(self):
        if not self.used:
            self.used = True
            self.save(update_fields=["used"])
