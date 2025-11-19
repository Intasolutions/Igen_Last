import React, { useState } from "react";
import API from "../../api/axios";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (p1 !== p2) {
      setErr("Passwords do not match.");
      return;
    }
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await API.post("users/password/reset/", { token, password: p1 });
      setMsg("Password reset successful. Redirecting to login…");
      setTimeout(() => nav("/"), 1200);
    } catch {
      setErr("Reset failed. The link may be invalid or expired.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-2">Set a new password</h1>
        {!token && (
          <div className="mb-4 text-red-600">
            Missing token. Please use the link from your email.
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            placeholder="New password"
            className="w-full px-4 py-2 border rounded-lg focus:outline-purple-600"
            required
          />
          <input
            type="password"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-4 py-2 border rounded-lg focus:outline-purple-600"
            required
          />
          <button
            type="submit"
            disabled={busy || !token}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-70"
          >
            {busy ? "Resetting…" : "Reset password"}
          </button>
        </form>
        {msg && <div className="mt-4 text-green-600">{msg}</div>}
        {err && <div className="mt-4 text-red-600">{err}</div>}
      </div>
    </div>
  );
}
