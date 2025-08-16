from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from companies.models import Company  # assuming you have Company model


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
            raise ValueError('Users must have a user_id')
        user = self.model(user_id=user_id, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, user_id, password=None, **extra_fields):
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_staff', True)
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
            raise ValueError('Users must have a user_id')
        user = self.model(user_id=user_id, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, user_id, password=None, **extra_fields):
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_staff', True)
        return self.create_user(user_id, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('SUPER_USER', 'Super User'),
        ('CENTER_HEAD', 'Center Head'),
        ('ACCOUNTANT', 'Accountant'),
        ('PROPERTY_MANAGER', 'Property Manager'),
    ]

    user_id = models.CharField(max_length=50, unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='ACCOUNTANT')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # Soft delete flag
    is_deleted = models.BooleanField(default=False)

    # Optional: assign user to one or more companies
    companies = models.ManyToManyField(Company, blank=True)

    USERNAME_FIELD = 'user_id'
    REQUIRED_FIELDS = []

    # Managers
    objects = SoftDeleteUserManager()   # default: excludes soft-deleted
    all_objects = AllUsersManager()     # includes soft-deleted

    def __str__(self):
        return f"{self.full_name} ({self.user_id})"

    # Instance-level soft delete API
    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.save(update_fields=['is_deleted'])

    def hard_delete(self, using=None, keep_parents=False):
        super(User, self).delete(using=using, keep_parents=keep_parents)

    def restore(self):
        if self.is_deleted:
            self.is_deleted = False
            self.save(update_fields=['is_deleted'])
