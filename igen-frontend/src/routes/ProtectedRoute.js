// src/routes/ProtectedRoute.js
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // make sure you're on jwt-decode v4+

const norm = (s) => String(s).toUpperCase().replace(/\s+/g, "_");

const logoutAndGoHome = () => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
  return <Navigate to="/" replace />;
};

const getToken = () =>
  localStorage.getItem("access") ||
  sessionStorage.getItem("access") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("token");

const parseRolesFrom = (dec, userBlob) => {
  const raw =
    dec?.role ??
    dec?.roles ??
    dec?.groups ??
    dec?.user?.role ??
    dec?.user?.roles ??
    userBlob?.roles ??
    (userBlob?.role ? [userBlob.role] : undefined);

  if (Array.isArray(raw)) return raw;
  if (raw) return [raw];
  const stored = localStorage.getItem("role") || sessionStorage.getItem("role");
  return stored ? [stored] : [];
};

const parseCompanyIdsFrom = (dec, userBlob) => {
  // support multiple possible claim shapes
  const c1 = dec?.company_id;
  const c2 = dec?.companies;
  const c3 = dec?.user?.company_id ?? dec?.user?.companies;
  const c4 = userBlob?.company_id ?? userBlob?.companies;
  const c5 = localStorage.getItem("company_id") || sessionStorage.getItem("company_id");

  // normalize to array of integers/strings
  const flat = []
    .concat(
      Array.isArray(c1) ? c1 : c1 ? [c1] : [],
      Array.isArray(c2) ? c2 : c2 ? [c2] : [],
      Array.isArray(c3) ? c3 : c3 ? [c3] : [],
      Array.isArray(c4) ? c4 : c4 ? [c4] : [],
      c5 ? [c5] : []
    )
    .map((v) => (v == null ? null : String(v).trim()))
    .filter(Boolean);

  // de-dup
  return Array.from(new Set(flat));
};

/**
 * ProtectedRoute
 * - allowedRoles: array of roles allowed; [] means "any authenticated"
 * - requireCompany: if true, non-super users must have at least one assigned company
 * - redirectTo: custom redirect path when blocked (defaults to "/")
 */
export default function ProtectedRoute({
  children,
  allowedRoles = [],
  requireCompany = false,
  redirectTo = "/",
}) {
  const location = useLocation();
  const token = getToken();
  if (!token) return <Navigate to="/" replace state={{ from: location }} />;

  let dec;
  try {
    dec = jwtDecode(token);
  } catch {
    return logoutAndGoHome();
  }

  // expiry check
  if (dec?.exp && dec.exp * 1000 < Date.now()) {
    return logoutAndGoHome();
  }

  // optional: read stored user blob as backup
  let userBlob = null;
  try {
    userBlob = JSON.parse(
      localStorage.getItem("user") ||
        sessionStorage.getItem("user") ||
        "null"
    );
  } catch {}

  const roles = parseRolesFrom(dec, userBlob).map(norm);
  const need = allowedRoles.map(norm);

  // role gate
  if (need.length && !roles.some((r) => need.includes(r))) {
    return <Navigate to={redirectTo} replace />;
  }

  // company gate (for scoped modules)
  if (requireCompany) {
    const isSuper = roles.includes("SUPER_USER");
    if (!isSuper) {
      const companyIds = parseCompanyIdsFrom(dec, userBlob);
      if (companyIds.length === 0) {
        // send them somewhere sensible (home or a “select company” page if you have one)
        return <Navigate to={redirectTo} replace />;
      }
    }
  }

  return children;
}
