# igen/settings.py
from pathlib import Path
import os
from datetime import timedelta

# ------------------------------------------------------------
# Load environment variables early (systemd points to /etc/igen.env)
# ------------------------------------------------------------
try:
    from dotenv import load_dotenv
    load_dotenv("/etc/igen.env")
except Exception:
    # If python-dotenv isn't available or file missing, just continue.
    pass

# ------------------------------------------------------------
# Core
# ------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

def env_bool(name: str, default: bool = False) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.lower() in {"1", "true", "yes", "on"}

def env_list(name: str, default_list):
    v = os.environ.get(name)
    if not v:
        return default_list
    # comma-separated values, trimmed
    return [x.strip() for x in v.split(",") if x.strip()]

# SECRET KEY
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or "!!-dev-only-insecure-key-change-in-prod-!!"

# DEBUG
DEBUG = env_bool("DJANGO_DEBUG", default=False)

# Hosts & CSRF
DEFAULT_ALLOWED_HOSTS = ["igenproperties.org", "www.igenproperties.org", "localhost", "127.0.0.1"]
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", DEFAULT_ALLOWED_HOSTS)

DEFAULT_CSRF_TRUSTED = [
    "https://igenproperties.org",
    "https://www.igenproperties.org",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", DEFAULT_CSRF_TRUSTED)

# ------------------------------------------------------------
# Applications
# ------------------------------------------------------------
INSTALLED_APPS = [
    # Project apps
    "users",
    "companies",

    # Django contrib
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "corsheaders",
    "django_extensions",
    "django_filters",

    # Domain apps
    "banks",
    "cost_centres",
    "transaction_types",
    "projects",
    "properties",
    "entities",
    "receipts",
    "assets",
    "contracts",
    "vendors",
    "reports",
    "contacts",
    "cash_ledger",
    "bank_uploads",
    "tx_classify",
    "analytics",  # ← new
]

AUTH_USER_MODEL = "users.User"

# ------------------------------------------------------------
# Middleware
# ------------------------------------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",

    # CORS must come before CommonMiddleware
    "corsheaders.middleware.CorsMiddleware",

    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "igen.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "igen.wsgi.application"

# ------------------------------------------------------------
# Database
#   (reads env, falls back to your current server values)
# ------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "igen_db"),
        "USER": os.environ.get("POSTGRES_USER", "igen_user"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "Igen@1234"),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

# ------------------------------------------------------------
# Password validation
# ------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ------------------------------------------------------------
# I18N / TZ
# ------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("TIME_ZONE", "Asia/Kolkata")
USE_I18N = True
USE_TZ = True

# ------------------------------------------------------------
# Static & Media
# ------------------------------------------------------------
# IMPORTANT: keep leading slashes for URL prefixes when behind Nginx
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ------------------------------------------------------------
# DRF & JWT
# ------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.environ.get("JWT_ACCESS_MINUTES", "60"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", "1"))),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "USER_ID_FIELD": "user_id",
    "USER_ID_CLAIM": "user_id",
    # Custom serializer including company_id and role
    "TOKEN_OBTAIN_SERIALIZER": "users.serializers.CustomTokenObtainPairSerializer",
}

# ------------------------------------------------------------
# CORS
#   Set CORS_ALLOW_ALL=1 in env only if you *really* need it.
# ------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL", False)
CORS_ALLOW_CREDENTIALS = True
if not CORS_ALLOW_ALL_ORIGINS:
    CORS_ALLOWED_ORIGINS = env_list(
        "CORS_ALLOWED_ORIGINS",
        ["https://igenproperties.org", "https://www.igenproperties.org", "http://localhost:3000"],
    )

# ------------------------------------------------------------
# Security (reverse proxy + HTTPS)
# ------------------------------------------------------------
# Ensure Django knows the original scheme when Nginx terminates TLS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

# Harden settings when not in DEBUG
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    # HSTS (start modestly; you can raise later)
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "63072000"))  # 2 years by default
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
    SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", True)

    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True  # harmless on modern Django
    X_FRAME_OPTIONS = "DENY"
    CSRF_COOKIE_HTTPONLY = False  # keep False so admin works normally

# ------------------------------------------------------------
# Logging (stdout for Gunicorn / journald)
# ------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "[%(levelname)s] %(asctime)s %(name)s: %(message)s"}
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
        }
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO" if not DEBUG else "DEBUG",
    },
}

# ------------------------------------------------------------
# Analytics tuning (Maintenance & Interior)
#
# The ledger code reads:
#   - ANALYTICS_MI_MATCHERS = {"slugs": [...], "names_icontains": [...], "ids": [..]}
#   - ANALYTICS_MI_TTYPE_ALIASES = [...]
#
# Env overrides (comma-separated lists):
#   ANALYTICS_MI_CC_ALIASES           -> common cost-centre slugs/names
#   ANALYTICS_MI_CC_SLUGS             -> explicit slugs (optional)
#   ANALYTICS_MI_CC_NAMES_ICONTAINS   -> explicit names (optional)
#   ANALYTICS_MI_CC_IDS               -> numeric IDs (optional)
#   ANALYTICS_MI_TTYPE_ALIASES        -> txn type name aliases
# ------------------------------------------------------------
ANALYTICS_MI_CC_ALIASES = env_list(
    "ANALYTICS_MI_CC_ALIASES",
    [
        "maintenance", "interior", "mi", "m & i", "m&i",
        "repairs", "upkeep",
        # project-specific example:
        "sfd",
    ],
)

_cc_slugs = env_list("ANALYTICS_MI_CC_SLUGS", ANALYTICS_MI_CC_ALIASES)
_cc_names = env_list("ANALYTICS_MI_CC_NAMES_ICONTAINS", ANALYTICS_MI_CC_ALIASES)
_cc_ids_raw = env_list("ANALYTICS_MI_CC_IDS", [])

_cc_ids: list[int] = []
for _v in _cc_ids_raw:
    try:
        _cc_ids.append(int(_v))
    except Exception:
        pass

ANALYTICS_MI_MATCHERS = {
    "slugs": _cc_slugs,               # matched against related cost_centre.slug or code
    "names_icontains": _cc_names,     # matched icontains on related/flat name
    "ids": _cc_ids,                   # direct cost_centre_id match
}

ANALYTICS_MI_TTYPE_ALIASES = env_list(
    "ANALYTICS_MI_TTYPE_ALIASES",
    ["maintenance", "interior", "m & i", "mi", "repairs", "upkeep"],
)
