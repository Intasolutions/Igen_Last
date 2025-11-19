# users/permissions_matrix_guard.py
from rest_framework.permissions import BasePermission

"""
Matrix-driven, role-based permission guard.

Typical usage:
  # Standard CRUD on a module
  PermCompanies = RoleActionPermission.bind("companies")
  permission_classes = [IsAuthenticated, PermCompanies]

  # Or the modern helper:
  permission_classes = [IsAuthenticated, RoleActionPermission.for_module("companies")]

  # For custom @action endpoints (e.g., 'summary', 'export'):
  @action(..., permission_classes=[IsAuthenticated, PermCompanies.action("summary")])
"""

# HTTP → logical action (fallback when DRF view.action is absent)
HTTP_TO_ACTION = {
    "GET": "list",
    "HEAD": "list",
    "OPTIONS": "list",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}

# DRF ViewSet action name → logical action
VIEW_ACTION_TO_ACTION = {
    "list": "list",
    "retrieve": "list",          # read treated as 'list'
    "create": "create",
    "update": "update",
    "partial_update": "update",
    "destroy": "delete",
}

# Synonym fallback so matrices using 'view/add/change/remove' also work
ACTION_SYNONYMS = {
    "list":   ("view",),
    "create": ("add",),
    "update": ("change", "edit"),
    "delete": ("remove",),
}


def _to_set(val) -> set[str]:
    """Accept list/tuple/set/singleton and normalize to a set of strings."""
    if val is None:
        return set()
    if isinstance(val, (list, tuple, set)):
        return {str(x) for x in val}
    return {str(val)}


class _RoleActionPermission(BasePermission):
    """
    Concrete permission class (created by RoleActionPermission.*) that checks
    users.permissions_matrix.PERMS for the given module/op.
    """

    module: str = ""
    op: str | None = None
    action_map: dict | None = None

    def has_permission(self, request, view):
        # ---- import matrix late to avoid circulars on reload ----
        try:
            from .permissions_matrix import PERMS as MATRIX
        except Exception:
            return False  # safest default

        # ---- resolve user & superuser bypass ----
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False

        # 🔑 Superuser bypass: real Django superusers can always proceed
        if getattr(user, "is_superuser", False):
            return True

        # ---- decide logical action to check ----
        action = self.op  # if fixed for a custom @action

        if not action:
            view_action = getattr(view, "action", None)
            if view_action:
                action = VIEW_ACTION_TO_ACTION.get(view_action)

        if not action:
            mapping = self.action_map or HTTP_TO_ACTION
            action = mapping.get(request.method.upper())

        if not action:
            return False

        # ---- role-based check for non-superusers ----
        role = getattr(user, "role", None)
        if not role:
            return False

        # ---- look up allowed roles in matrix (with synonym fallbacks) ----
        module_cfg = (MATRIX or {}).get(self.module, {})

        allowed = _to_set(module_cfg.get(action))

        # Special: if action was "list" and empty, fall back to "view"
        if not allowed and action == "list":
            allowed = _to_set(module_cfg.get("view"))

        # General synonyms (e.g., change/edit → update)
        if not allowed:
            for alt in ACTION_SYNONYMS.get(action, ()):
                allowed = _to_set(module_cfg.get(alt))
                if allowed:
                    break

        # Secure default: if still empty, only SUPER_USER role may proceed
        if not allowed:
            return role == "SUPER_USER"

        return role in allowed

    # Allow calling PermX.action("summary") on the already-bound class
    @classmethod
    def action(cls, action_name: str):
        module = getattr(cls, "module", None)
        if not module:
            raise RuntimeError(
                "RoleActionPermission.action() must be called on a class created via .bind/.for_module."
            )
        action_map = getattr(cls, "action_map", None)
        return RoleActionPermission.for_module(module=module, op=action_name, action_map=action_map)


class RoleActionPermission:
    """
    Factory for DRF permission classes parameterized by (module, op).

    Use:
      RoleActionPermission.for_module("companies")
      RoleActionPermission.for_module("companies", op="update")
      RoleActionPermission.bind("companies")  # back-compat alias
    """

    @classmethod
    def for_module(cls, module: str, op: str | None = None, action_map: dict | None = None):
        attrs = {
            "module": module,
            "op": op,
            "action_map": action_map,
            "__doc__": f"Permission guard for module='{module}', op='{op or 'auto'}'.",
        }
        name = f"Perm_{module}_{op or 'auto'}"
        return type(name, (_RoleActionPermission,), attrs)

    # Back-compat for older code
    @classmethod
    def bind(cls, module: str, action_map: dict | None = None):
        return cls.for_module(module=module, action_map=action_map)
