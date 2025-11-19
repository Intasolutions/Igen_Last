# users/scoping.py
from django.db.models import QuerySet

def is_super(user) -> bool:
    return bool(getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_USER")

def company_scope_qs(user, qs: QuerySet, company_field: str = "company") -> QuerySet:
    """
    Restrict a queryset to the user's assigned companies.
    Super users are exempt.
    company_field can be a path, e.g. "asset__company".
    """
    if is_super(user):
        return qs
    comps = getattr(user, "companies", None)
    if not comps:
        return qs.none()
    try:
        ids = list(comps.values_list("id", flat=True))
    except Exception:
        return qs.none()
    if not ids:
        return qs.none()
    return qs.filter(**{f"{company_field}__in": ids})
