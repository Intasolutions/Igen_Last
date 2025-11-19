// src/utils/perm.js

// ---------- token & payload helpers ----------
function readAccessToken() {
  try {
    return localStorage.getItem("access") || "";
  } catch {
    return "";
  }
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    const p = parts[1];
    if (!p) return {};
    // base64url -> base64
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return {};
  }
}

function readUserRolesFallback() {
  try {
    const fromRole = localStorage.getItem("role");
    if (fromRole) return [String(fromRole)];
    const raw = localStorage.getItem("user");
    if (!raw) return [];
    const u = JSON.parse(raw);
    if (Array.isArray(u.roles)) return u.roles.map(String);
    if (u.role) return [String(u.role)];
    return [];
  } catch {
    return [];
  }
}

// ---------- roles API ----------
export function getSessionRoles() {
  const token = readAccessToken();
  const payload = decodeJwtPayload(token);

  let roles =
    Array.isArray(payload.roles) ? payload.roles :
    payload.role ? [payload.role] : [];

  if (!roles.length) roles = readUserRolesFallback();

  return roles.map((r) => String(r).toUpperCase());
}

export function hasRole(need) {
  const have = getSessionRoles();
  const want = (Array.isArray(need) ? need : [need]).map((r) =>
    String(r).toUpperCase()
  );
  return want.some((r) => have.includes(r));
}

// Convenience constants
export const ROLES = {
  SU: "SUPER_USER",
  CH: "CENTER_HEAD",
  AC: "ACCOUNTANT",
  PM: "PROPERTY_MANAGER",
};

// ---------- Matrix: keep in sync with backend users/permissions_matrix.py ----------
const MATRIX = {
  users: {
    list:   [ROLES.SU],
    create: [ROLES.SU],
    update: [ROLES.SU],
    delete: [ROLES.SU],
    summary:[ROLES.SU, ROLES.CH, ROLES.AC],
  },

  companies: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC],
    create: [ROLES.SU],
    update: [ROLES.SU],
    delete: [ROLES.SU],
  },

  banks: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC],
    create: [ROLES.SU],
    update: [ROLES.SU],
    delete: [ROLES.SU],
  },

  cost_centres: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC],
    create: [ROLES.SU, ROLES.AC],
    update: [ROLES.SU, ROLES.AC],
    delete: [ROLES.SU, ROLES.AC],
  },

  transaction_types: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC],
    create: [ROLES.SU, ROLES.AC],
    update: [ROLES.SU, ROLES.AC],
    delete: [ROLES.SU, ROLES.AC],
  },

  entities: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC, ROLES.PM],
    create: [ROLES.SU, ROLES.AC, ROLES.PM],
    update: [ROLES.SU, ROLES.AC, ROLES.PM],
    delete: [ROLES.SU, ROLES.AC],
  },

  properties: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC, ROLES.PM],
    create: [ROLES.SU, ROLES.AC, ROLES.PM],
    update: [ROLES.SU, ROLES.AC, ROLES.PM],
    delete: [ROLES.SU, ROLES.AC],
  },

  projects: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC, ROLES.PM],
    create: [ROLES.SU, ROLES.AC],
    update: [ROLES.SU, ROLES.AC],
    delete: [ROLES.SU, ROLES.AC],
  },

  assets: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC, ROLES.PM],
    create: [ROLES.SU, ROLES.AC, ROLES.PM],
    update: [ROLES.SU, ROLES.AC, ROLES.PM],
    delete: [ROLES.SU, ROLES.AC],
  },

  cash_ledger: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC, ROLES.PM],
    create: [ROLES.SU, ROLES.AC, ROLES.PM],
    update: [ROLES.SU, ROLES.AC],
    delete: [ROLES.SU, ROLES.AC],
  },

  bank_uploads: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC],
    create: [ROLES.SU, ROLES.AC],
  },

  tx_classify: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC],
    create: [ROLES.SU, ROLES.AC],
    update: [ROLES.SU, ROLES.AC],
  },

  contracts: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC, ROLES.PM],
    create: [ROLES.SU, ROLES.AC, ROLES.PM],
    update: [ROLES.SU, ROLES.AC, ROLES.PM],
    delete: [ROLES.SU, ROLES.AC],
  },

  vendors: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC, ROLES.PM],
    create: [ROLES.SU, ROLES.AC],
    update: [ROLES.SU, ROLES.AC],
    delete: [ROLES.SU, ROLES.AC],
  },

  contacts: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC, ROLES.PM],
    create: [ROLES.SU, ROLES.AC, ROLES.PM],
    update: [ROLES.SU, ROLES.AC],
    delete: [ROLES.SU, ROLES.AC],
  },

  // BACKEND restricts this to SU/CH/AC only
  entity_report: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC],
    create: [ROLES.SU, ROLES.AC],
    update: [ROLES.SU, ROLES.AC],
    delete: [ROLES.SU, ROLES.AC],
  },

  analytics: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC],
    create: [ROLES.SU, ROLES.AC],
    update: [ROLES.SU, ROLES.AC],
    delete: [ROLES.SU, ROLES.AC],
  },

  dashboard_stats: {
    list:   [ROLES.SU, ROLES.CH, ROLES.AC],
  },

  // (Optional) separate "reports" convenience used elsewhere
  reports: {
    list:    [ROLES.SU, ROLES.CH, ROLES.AC, ROLES.PM],
    summary: [ROLES.SU, ROLES.CH, ROLES.AC, ROLES.PM],
    export:  [ROLES.SU, ROLES.AC],
  },
};

// ---------- generic helpers ----------
function allowed(moduleKey, action) {
  const entry = MATRIX[moduleKey] || {};
  const roles = entry[action] || [];
  return hasRole(roles);
}

export const canList    = (moduleKey) => allowed(moduleKey, "list");
export const canCreate  = (moduleKey) => allowed(moduleKey, "create");
export const canUpdate  = (moduleKey) => allowed(moduleKey, "update");
export const canDelete  = (moduleKey) => allowed(moduleKey, "delete");
export const canSummary = (moduleKey) => allowed(moduleKey, "summary");
export const canExport  = (moduleKey) => allowed(moduleKey, "export");

// ---------- shortcuts used around the app ----------
export const perms = {
  editProjects:   () => canCreate("projects") || canUpdate("projects") || canDelete("projects"),
  editVendors:    () => canCreate("vendors")  || canUpdate("vendors")  || canDelete("vendors"),
  actTxClassify:  () => canCreate("tx_classify") || canUpdate("tx_classify"),
  exportReports:  () => canExport("reports"),

  viewDashboard:      () => canList("dashboard_stats"),
  // ⬇️ key fix: tie to entity_report, not generic reports
  viewEntityReport:   () => canList("entity_report"),
  viewCompanies:      () => canList("companies"),
  viewBankUploads:    () => canList("bank_uploads"),
  viewTxClassify:     () => canList("tx_classify"),
  viewCashLedger:     () => canList("cash_ledger"),
  viewAnalytics:      () => canList("analytics"),
};

export default perms;
