// src/modules/Auth/Login.js
import React, { useState, useEffect } from "react";
import API from "../../api/axios";
import { jwtDecode } from "jwt-decode";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function Login() {
  const [user_id, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState(""); // 'success' | 'error'
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const normalizeRole = (r) =>
    r ? String(r).toUpperCase().replace(/\s+/g, "_") : undefined;

  const extractClaims = (access, payload = {}) => {
    let role =
      payload.role ??
      payload.user?.role ??
      (() => {
        try {
          const dec = jwtDecode(access);
          return (
            dec?.role ??
            dec?.user?.role ??
            (Array.isArray(dec?.roles) ? dec.roles[0] : undefined)
          );
        } catch {
          return undefined;
        }
      })();

    let uid = payload.user_id ?? payload.user?.user_id;

    let company_id =
      payload.company_id ??
      payload.user?.company_id ??
      (() => {
        try {
          const dec = jwtDecode(access);
          return dec?.company_id ?? dec?.user?.company_id ?? undefined;
        } catch {
          return undefined;
        }
      })();

    const companies = (() => {
      const fromPayload = payload.companies ?? payload.user?.companies ?? [];
      if (Array.isArray(fromPayload) && fromPayload.length) return fromPayload;
      try {
        const dec = jwtDecode(access);
        const arr =
          dec?.companies ?? dec?.user?.companies ?? (company_id ? [company_id] : []);
        return Array.isArray(arr) ? arr : arr ? [arr] : [];
      } catch {
        return company_id ? [company_id] : [];
      }
    })();

    const mustReset =
      payload.must_reset_password ??
      (() => {
        try {
          const dec = jwtDecode(access);
          return Boolean(dec?.must_reset_password);
        } catch {
          return false;
        }
      })() ??
      false;

    return {
      role: normalizeRole(role) || "UNKNOWN",
      uid,
      company_id,
      companies: Array.from(new Set((companies || []).map(String))),
      must_reset_password: !!mustReset,
    };
  };

  const setAuthHeader = (access) => {
    try {
      API.defaults.headers.common.Authorization = `Bearer ${access}`;
    } catch {}
  };

  const clearAuth = () => {
    try {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      localStorage.removeItem("company_id");
      localStorage.removeItem("companies");
    } catch {}
    try {
      delete API.defaults.headers.common.Authorization;
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await API.post("users/token/", { user_id, password });

      const {
        access,
        refresh,
        role,
        user_id: uid,
        company_id,
        companies,
        must_reset_password,
      } = res.data || {};

      if (!access) {
        throw new Error("No access token returned.");
      }

      localStorage.setItem("access", access);
      if (refresh) localStorage.setItem("refresh", refresh);

      const claims = extractClaims(access, {
        role,
        user_id: uid,
        company_id,
        companies,
        must_reset_password,
      });

      localStorage.setItem("role", claims.role);
      if (claims.company_id)
        localStorage.setItem("company_id", String(claims.company_id));
      localStorage.setItem("companies", JSON.stringify(claims.companies || []));
      localStorage.setItem(
        "user",
        JSON.stringify({
          user_id: claims.uid ?? user_id,
          role: claims.role,
          roles: [claims.role],
          company_id: claims.company_id ?? null,
          companies: claims.companies || [],
        })
      );

      setAuthHeader(access);

      if (claims.must_reset_password) {
        setType("success");
        setMessage("Welcome! Please set your new password.");
        navigate("/first-time-setup", {
          replace: true,
          state: { user_id: claims.uid ?? user_id },
        });
        return;
      }

      setType("success");
      setMessage("Login successful! Redirecting…");
      navigate(from, { replace: true });
    } catch (err) {
      const apiMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (Array.isArray(err?.response?.data?.non_field_errors)
          ? err.response.data.non_field_errors.join(", ")
          : "") ||
        err?.message ||
        "Login failed: check your credentials.";
      setType("error");
      setMessage(apiMsg);
      clearAuth();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-gray-800 relative overflow-hidden">
      {message && (
        <div
          className={`absolute top-5 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-md transition-all duration-300 ${
            type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {message}
        </div>
      )}

      {/* Left Visual */}
      <div className="hidden lg:flex flex-col items-center justify-center w-1/2 bg-igen relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1.5 }}
          className="absolute w-[600px] h-[600px] bg-shadow rounded-full blur-[120px] animate-pulse"
        />
        <motion.img
          src="/logo/igen.png"
          alt="Visual"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5 }}
          className="w-[600px] z-10"
        />
      </div>

      {/* Right Form */}
      <div className="flex flex-col justify-center w-full lg:w-1/2 px-8 py-12">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-md w-full mx-auto"
        >
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-gray-700">Hi</h2>
            <motion.span
              animate={{ rotate: [0, 20, -15, 10, -5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              className="text-3xl"
            >
              👋
            </motion.span>
            <h2 className="text-2xl font-bold text-gray-700">Welcome back</h2>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            Login to access your dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <input
              type="text"
              value={user_id}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="w-full px-4 py-2 border rounded-lg focus:outline-purple-600"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full px-4 py-2 border rounded-lg focus:outline-purple-600"
              required
            />

            {/* Only first-time setup link remains */}
            <div className="text-right">
              <Link
                to="/first-time-setup"
                className="text-sm text-gray-500 hover:underline"
                state={{ user_id }}
              >
                First time here?
              </Link>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all disabled:opacity-70"
              disabled={submitting}
            >
              {submitting ? "Logging in…" : "Login"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
