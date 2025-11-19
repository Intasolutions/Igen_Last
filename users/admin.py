from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    # Show both active & soft-deleted users in the changelist
    def get_queryset(self, request):
        # Use all_objects so admin can see/restore deleted users too
        qs = User.all_objects.all()
        return qs.order_by(*self.ordering)

    ordering = ["id"]
    list_display = [
        "user_id",
        "full_name",
        "email",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "is_deleted",
    ]
    list_filter = ["role", "is_active", "is_staff", "is_superuser", "is_deleted"]
    search_fields = ["user_id", "full_name", "email"]

    fieldsets = (
        (None, {"fields": ("user_id", "password")}),
        ("Personal Info", {"fields": ("full_name", "email", "role", "companies")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Status", {"fields": ("is_deleted",)}),
        ("Important dates", {"fields": ("last_login",)}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "user_id", "password1", "password2",
                "full_name", "email", "role", "companies",
                "is_active", "is_staff", "is_superuser",
            ),
        }),
    )

    # ----- Soft-delete aware delete operations -----
    def delete_model(self, request, obj):
        """Single-object delete from admin: perform SOFT delete."""
        obj.delete()

    def delete_queryset(self, request, queryset):
        """Bulk delete from admin: perform SOFT delete for each."""
        queryset.delete()

    # ----- Admin actions -----
    actions = ["admin_soft_delete", "admin_restore", "admin_hard_delete"]

    @admin.action(description="Soft delete selected users")
    def admin_soft_delete(self, request, queryset):
        queryset.update(is_deleted=True)

    @admin.action(description="Restore selected users")
    def admin_restore(self, request, queryset):
        queryset.update(is_deleted=False)

    @admin.action(description="HARD delete selected users (permanent)")
    def admin_hard_delete(self, request, queryset):
        for obj in queryset:
            obj.hard_delete()

    # ----- Permission gates: superuser-only as you had -----
    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser
