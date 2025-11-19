# users/permissions_matrix.py
# AUTO-GENERATED to match client spec EXACTLY from Module_Permissions_updated.csv
# Mapping rules:
# - "Full access"        => list, create, update, delete
# - "View"               => list
# - "Create/Update"      => list, create, update
# - "Create" / "Create Access" => list, create
# - "No Access"          => (no actions)

PERMS = {
    # --- Admin / Security ---
    "users": {
        # allow PM to read when FE filters by ?role=PROPERTY_MANAGER
        "list":   ["SUPER_USER", "PROPERTY_MANAGER"],
        "create": ["SUPER_USER"],
        "update": ["SUPER_USER"],
        "delete": ["SUPER_USER"],
        # lightweight lookups (spent-by, property-managers, etc.)
        "summary": ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],
    },

    # --- Core Setup ---
    # "Company Setup" → "companies"
    "companies": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],  # PM can read for filters
        "create": ["SUPER_USER"],
        "update": ["SUPER_USER"],
        "delete": ["SUPER_USER"],
    },

    # "Bank Account Setup" → "banks"
    "banks": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT"],
        "create": ["SUPER_USER"],
        "update": ["SUPER_USER"],
        "delete": ["SUPER_USER"],
    },

    # "Cost Centre" → "cost_centres"
    "cost_centres": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],  # PM can read for filters
        "create": ["SUPER_USER", "ACCOUNTANT"],   # Accountant: Full Access
        "update": ["SUPER_USER", "ACCOUNTANT"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # "Transaction Type" → "transaction_types"
    "transaction_types": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],  # PM can read for filters
        "create": ["SUPER_USER", "ACCOUNTANT"],   # Accountant: Full Access
        "update": ["SUPER_USER", "ACCOUNTANT"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # --- Master Data ---
    # "Entity" → "entities"
    # SU: Full | CH: View | AC: Full | PM: Create/Update
    "entities": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "create": ["SUPER_USER", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "update": ["SUPER_USER", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # "Property Master" → "properties"
    # SU: Full | CH: View | AC: Full | PM: Create/Update
    "properties": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "create": ["SUPER_USER", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "update": ["SUPER_USER", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # "Project Master" → "projects"
    # SU: Full | CH: View | AC: Full | PM: View
    "projects": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "create": ["SUPER_USER", "ACCOUNTANT"],
        "update": ["SUPER_USER", "ACCOUNTANT"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # "Asset Module" → "assets"
    # SU: Full | CH: View | AC: Full | PM: Create/Update
    "assets": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "create": ["SUPER_USER", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "update": ["SUPER_USER", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # --- Transactions / Ops ---
    # petty cash / cash-out module
    "cash_ledger": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],  # PM allowed
        "create": ["SUPER_USER", "ACCOUNTANT", "PROPERTY_MANAGER"],                 # PM allowed
        "update": ["SUPER_USER", "ACCOUNTANT"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # Bank statement upload & reads
    "bank_uploads": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT"],
        "create": ["SUPER_USER", "ACCOUNTANT"],
    },

    # Transaction classification
    "tx_classify": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT"],
        "create": ["SUPER_USER", "ACCOUNTANT"],  # classify/split actions
        "update": ["SUPER_USER", "ACCOUNTANT"],  # re-split / re-classify
    },

    # --- Contracts & Vendors ---
    "contracts": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "create": ["SUPER_USER", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "update": ["SUPER_USER", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    "vendors": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "create": ["SUPER_USER", "ACCOUNTANT"],
        "update": ["SUPER_USER", "ACCOUNTANT"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # --- Contacts ---
    "contacts": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "create": ["SUPER_USER", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "update": ["SUPER_USER", "ACCOUNTANT"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # --- Reports / Dashboards ---
    # "Entity-Wise Report" → "entity_report"
    "entity_report": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT"],
        "create": ["SUPER_USER", "ACCOUNTANT"],
        "update": ["SUPER_USER", "ACCOUNTANT"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # "Analysis" → "analytics"
    "analytics": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT"],
        "create": ["SUPER_USER", "ACCOUNTANT"],
        "update": ["SUPER_USER", "ACCOUNTANT"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },

    # "Dashboard" → "dashboard_stats"
    "dashboard_stats": {
        "list":   ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT"],
        "create": ["SUPER_USER", "ACCOUNTANT"],
        "update": ["SUPER_USER", "ACCOUNTANT"],
        "delete": ["SUPER_USER", "ACCOUNTANT"],
    },
}

# --- begin permissive additions for dashboard & reports (added by ops) ---
try:
    # Keep dashboard read access aligned with CSV (NO Property Manager)
    PERMS.setdefault("dashboard_stats", {}).update({
        "list": ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT"]
    })

    # Reports: allow viewing/summary to SU/CH/AC/PM; export to SU/AC
    PERMS.setdefault("reports", {}).update({
        "list":    ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "summary": ["SUPER_USER", "CENTER_HEAD", "ACCOUNTANT", "PROPERTY_MANAGER"],
        "export":  ["SUPER_USER", "ACCOUNTANT"],
    })
except NameError:
    pass
# --- end additions ---
