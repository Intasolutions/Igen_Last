from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.utils import timezone  # ← already used below

from .models import User, PasswordReset
from .serializers import UserSerializer, UserLiteSerializer
from users.permissions_matrix_guard import RoleActionPermission


def _safe_name(u):
    """
    Build a display name without calling model methods.
    Tries: full_name, name, username, user_id, or "first last".
    """
    parts = [
        getattr(u, "full_name", None),
        getattr(u, "name", None),
        getattr(u, "username", None),
        getattr(u, "user_id", None),
        " ".join(filter(None, [getattr(u, "first_name", None), getattr(u, "last_name", None)])).strip(),
    ]
    for p in parts:
        if p and str(p).strip():
            return str(p).strip()
    return str(getattr(u, "user_id", u.pk))


class UserViewSet(viewsets.ModelViewSet):
    """
    User CRUD with role-matrix permissions and soft-delete.

    Matrix module_key="users":
      - list/create/update/delete controlled by permissions_matrix.py
      - summary (lightweight reads) is allowed to SU/CH/AC/PM as per matrix

    Summary mode triggers when the request is clearly for a lightweight list:
      - has any of: ?role=..., ?is_active=true, ?summary=1, or ?fields=...
    In that case we allow via 'users.summary' instead of 'users.list'.
    """

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, RoleActionPermission.for_module("users")]

    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["role"]
    ordering_fields = ["created_at", "full_name", "user_id", "is_active"]
    ordering = ["-created_at"]

    queryset = User.objects.all().order_by("-created_at")

    # ---------- permission switching for summary mode ----------

    def _is_summary_mode(self) -> bool:
        qp = self.request.query_params
        return (
            "role" in qp
            or "is_active" in qp
            or qp.get("summary") in ("1", "true", "yes")
            or bool(qp.get("fields"))
        )

    def get_permissions(self):
        """
        If we're handling the list action and the request is a lightweight
        "summary" fetch, enforce 'users.summary' instead of 'users.list'.
        """
        if getattr(self, "action", None) == "list" and self._is_summary_mode():
            return [
                IsAuthenticated(),
                RoleActionPermission.for_module("users", op="summary")(),
            ]
        return [perm() for perm in self.permission_classes]

    # ---------- queryset scoping ----------

    def get_queryset(self):
        """
        SUPER_USER may include soft-deleted via ?include_deleted=true on full lists.
        """
        include_deleted = (self.request.query_params.get("include_deleted") or "").lower() in (
            "1",
            "true",
            "yes",
        )
        user_role = getattr(self.request.user, "role", None)

        if user_role == "SUPER_USER":
            base = User.all_objects if include_deleted else User.objects
            return base.all().order_by(*self.ordering)

        return User.objects.none()

    # ---------- list (supports summary + full) ----------

    def list(self, request, *args, **kwargs):
        """
        Summary mode:
          - Allowed via users.summary
          - Filters: role, is_active
          - Search: q over full_name/user_id/email
          - Fields: fields=id,name,... for lightweight payload
        Full mode (SU only via users.list):
          - Uses standard serializer & pagination
        """
        if self._is_summary_mode():
            qs = User.objects.filter(is_deleted=False)

            role = request.query_params.get("role")
            if role:
                qs = qs.filter(role=role)

            is_active = request.query_params.get("is_active")
            if is_active in ("1", "true", "yes"):
                qs = qs.filter(is_active=True)

            q = (request.query_params.get("q") or "").strip()
            if q:
                qs = qs.filter(
                    Q(full_name__icontains=q)
                    | Q(user_id__icontains=q)
                    | Q(email__icontains=q)
                )

            qs = qs.order_by("full_name", "user_id")

            fields = request.query_params.get("fields")
            if fields:
                wanted = [f.strip() for f in fields.split(",") if f.strip()]
                out = []
                for u in qs:
                    row = {}
                    for f in wanted:
                        if f == "name":
                            row["name"] = _safe_name(u)
                        elif hasattr(u, f):
                            row[f] = getattr(u, f)
                        elif f == "id":
                            row["id"] = u.id
                        else:
                            row[f] = None
                    out.append(row)
                return Response(out)

            return Response(UserLiteSerializer(qs, many=True).data)

        return super().list(request, *args, **kwargs)

    # ---------- CRUD ----------

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if not data.get("user_id") or not data.get("password"):
            return Response(
                {"detail": "Both user_id and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if getattr(user, "is_deleted", False):
            return Response({"detail": "User is already soft-deleted"}, status=status.HTTP_400_BAD_REQUEST)
        user.is_deleted = True
        user.save(update_fields=["is_deleted"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ---------- Custom actions ----------

    @action(
        detail=True,
        methods=["post"],
        url_path="deactivate",
        permission_classes=[IsAuthenticated, RoleActionPermission.for_module("users", op="update")],
    )
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"detail": "User deactivated successfully"})

    @action(
        detail=True,
        methods=["post"],
        url_path="reset-password",
        permission_classes=[IsAuthenticated, RoleActionPermission.for_module("users", op="update")],
    )
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get("password")
        if not new_password:
            return Response({"detail": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.must_reset_password = False
        user.password_changed_at = timezone.now()
        user.save(update_fields=["password", "must_reset_password", "password_changed_at"])
        return Response({"detail": "Password reset successfully"})

    @action(
        detail=True,
        methods=["post"],
        url_path="soft-delete",
        permission_classes=[IsAuthenticated, RoleActionPermission.for_module("users", op="delete")],
    )
    def soft_delete(self, request, pk=None):
        user = self.get_object()
        if getattr(user, "is_deleted", False):
            return Response({"detail": "User is already soft-deleted"}, status=status.HTTP_400_BAD_REQUEST)
        user.is_deleted = True
        user.save(update_fields=["is_deleted"])
        return Response({"detail": "User soft-deleted successfully"})

    @action(
        detail=True,
        methods=["post"],
        url_path="restore",
        permission_classes=[IsAuthenticated, RoleActionPermission.for_module("users", op="update")],
    )
    def restore(self, request, pk=None):
        try:
            user = User.all_objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if not getattr(user, "is_deleted", False):
            return Response({"detail": "User is not soft-deleted"}, status=status.HTTP_400_BAD_REQUEST)

        user.is_deleted = False
        user.save(update_fields=["is_deleted"])
        return Response({"detail": "User restored successfully"})

    @action(
        detail=False,
        methods=["get"],
        url_path="roles",
        permission_classes=[IsAuthenticated, RoleActionPermission.for_module("users", op="list")],
    )
    def roles(self, request):
        data = [{"id": key, "name": label} for key, label in User.ROLE_CHOICES]
        return Response(data)

    @action(
        detail=False,
        methods=["get"],
        url_path="property-managers",
        permission_classes=[IsAuthenticated, RoleActionPermission.for_module("users", op="summary")],
    )
    def property_managers(self, request):
        q = (request.query_params.get("q") or "").strip()
        qs = User.objects.filter(role="PROPERTY_MANAGER", is_active=True, is_deleted=False)
        if q:
            qs = qs.filter(
                Q(full_name__icontains=q) | Q(user_id__icontains=q) | Q(email__icontains=q)
            )
        qs = qs.order_by("full_name", "user_id")
        return Response(UserLiteSerializer(qs, many=True).data)

    # ---------- Public password reset by token (kept for future email/SMS) ----------

    @action(
        detail=False,
        methods=["post"],
        url_path="password/forgot",
        permission_classes=[],  # public
    )
    def password_forgot(self, request):
        """
        Accepts {email} or {user_id}. Always return generic message to avoid user enumeration.
        """
        identifier = (request.data.get("email") or request.data.get("user_id") or "").strip()
        try:
            if "@" in identifier:
                user = User.objects.get(email__iexact=identifier, is_deleted=False)
            else:
                user = User.objects.get(user_id=identifier, is_deleted=False)
            PasswordReset.issue(user)
            # NOTE: no email/SMS send here (can be wired later).
        except User.DoesNotExist:
            pass
        return Response({"detail": "If an account exists, a reset link has been sent."})

    @action(
        detail=False,
        methods=["post"],
        url_path="password/reset",
        permission_classes=[],  # public
    )
    def password_reset(self, request):
        """
        Accepts {token, password}. Validates token, sets password, invalidates token.
        """
        token = (request.data.get("token") or "").strip()
        new_pw = request.data.get("password")
        if not token or not new_pw:
            return Response({"detail": "token and password are required"}, status=400)

        try:
            pr = PasswordReset.objects.select_related("user").get(token=token, used=False)
            if pr.expires_at < timezone.now():
                return Response({"detail": "token expired"}, status=400)
        except PasswordReset.DoesNotExist:
            return Response({"detail": "invalid token"}, status=400)

        u = pr.user
        u.set_password(new_pw)
        u.must_reset_password = False
        u.password_changed_at = timezone.now()
        u.save(update_fields=["password", "must_reset_password", "password_changed_at"])

        pr.used = True
        pr.save(update_fields=["used"])
        return Response({"detail": "Password reset successful."})

    # ---------- NEW: Email-free first-time password set flow ----------

    @action(
        detail=False,
        methods=["post"],
        url_path="password/first-time/init",
        permission_classes=[],  # public
    )
    def first_time_init(self, request):
        """
        Body: { user_id }
        Response: { eligible: true|false }
        - true  => user exists, is_active=True, is_deleted=False, must_reset_password=True
        - false => otherwise
        Never reveals whether the user exists beyond eligibility.
        """
        uid = (request.data.get("user_id") or "").strip()
        eligible = False
        if uid:
            try:
                u = User.objects.get(user_id=uid, is_deleted=False)
                eligible = bool(u.is_active and u.must_reset_password)
            except User.DoesNotExist:
                pass
        return Response({"eligible": eligible})

    @action(
        detail=False,
        methods=["post"],
        url_path="password/first-time/complete",
        permission_classes=[],  # public
    )
    def first_time_complete(self, request):
        """
        Body: { user_id, password }
        Only works if must_reset_password=True.
        """
        uid = (request.data.get("user_id") or "").strip()
        new_pw = request.data.get("password")
        if not uid or not new_pw:
            return Response({"detail": "user_id and password are required"}, status=400)

        try:
            u = User.objects.get(user_id=uid, is_deleted=False)
        except User.DoesNotExist:
            # Keep response generic
            return Response({"detail": "Unable to complete first-time setup."}, status=400)

        if not u.is_active or not u.must_reset_password:
            return Response({"detail": "First-time setup is not available for this account."}, status=400)

        u.set_password(new_pw)
        u.must_reset_password = False
        u.password_changed_at = timezone.now()
        u.save(update_fields=["password", "must_reset_password", "password_changed_at"])
        return Response({"detail": "Password has been set. You can now log in."})
