// src/api/axios.js
import axios from "axios";

/** ─────────────────────────────
 *  Config
 *  ────────────────────────────*/
const REFRESH_PATH = "users/token/refresh/"; // matches your backend
const LOGIN_PATH = "/"; // where to redirect if refresh fails

/** ─────────────────────────────
 *  Resolve API base URL
 *  ────────────────────────────*/
function getEnvBase() {
  // Vite
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  // CRA
  if (typeof process !== "undefined" && process.env?.REACT_APP_API_BASE) {
    return process.env.REACT_APP_API_BASE;
  }
  return null;
}

const envBase = getEnvBase();
const isBrowser = typeof window !== "undefined";
const isLocal =
  isBrowser && ["localhost", "127.0.0.1"].includes(window.location.hostname);

// Final base: always ends with "/api/"
export const API_BASE = (
  envBase
    ? envBase
    : isLocal
    ? "http://127.0.0.1:8000"
    : isBrowser
    ? window.location.origin
    : ""
)
  .replace(/\/+$/, "")
  .concat("/api/");

const API = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

/** ─────────────────────────────
 *  Helpers
 *  ────────────────────────────*/
function redirectToLogin() {
  try {
    localStorage.clear();
  } catch (_) {}
  if (typeof window !== "undefined") window.location.href = LOGIN_PATH;
}

async function refreshAccessToken(refresh) {
  const url = new URL(REFRESH_PATH, API.defaults.baseURL).toString();
  const { data } = await axios.post(url, { refresh }, { timeout: 10000 });
  const newAccess = data?.access;
  if (!newAccess) throw new Error("No access token in refresh response");
  localStorage.setItem("access", newAccess);
  return newAccess;
}

/** ─────────────────────────────
 *  Request interceptor
 *  - keep /api/ prefix working for relative URLs
 *  - add basic alias for legacy "roles/" → "users/roles/"
 *  - attach Authorization
 *  ────────────────────────────*/
API.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};

    // Remove leading slash on relative URLs so axios keeps baseURL "/api/"
    if (
      typeof config.url === "string" &&
      config.url.startsWith("/") &&
      !/^https?:\/\//i.test(config.url)
    ) {
      config.url = config.url.slice(1); // "/users/roles/" -> "users/roles/"
    }

    // Back-compat: plain "roles/" to "users/roles/"
    if (typeof config.url === "string") {
      const u = config.url.replace(/^\//, "");
      if (u === "roles" || u === "roles/") {
        config.url = "users/roles/";
      }
    }

    // Auth header
    const token = localStorage.getItem("access");
    if (token) config.headers.Authorization = `Bearer ${token}`;

    return config;
  },
  (error) => Promise.reject(error)
);

/** ─────────────────────────────
 *  Response interceptor (401 → refresh → retry)
 *  ────────────────────────────*/
let refreshingPromise = null;

API.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error?.config;

    if (!error?.response) return Promise.reject(error);

    if (error.response.status === 401 && original && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh");
      if (!refresh) {
        redirectToLogin();
        return Promise.reject(error);
      }

      try {
        if (!refreshingPromise) {
          refreshingPromise = refreshAccessToken(refresh).finally(() => {
            refreshingPromise = null;
          });
        }
        const newAccess = await refreshingPromise;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return API.request(original);
      } catch (e) {
        redirectToLogin();
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

/** ─────────────────────────────
 *  Utilities
 *  ────────────────────────────*/
export function logout() {
  redirectToLogin();
}

export function initAuthSync() {
  if (typeof window === "undefined") return;
  window.addEventListener("storage", (e) => {
    if (e.key === "access" && !e.newValue) {
      window.location.href = LOGIN_PATH;
    }
  });
}

export default API;
