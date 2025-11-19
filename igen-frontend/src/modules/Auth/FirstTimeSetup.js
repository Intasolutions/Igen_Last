// src/modules/Auth/FirstTimeSetup.js
import React, { useState } from "react";
import API from "../../api/axios";
import { useNavigate } from "react-router-dom";

export default function FirstTimeSetup() {
  const [userId, setUserId] = useState("");
  const [eligible, setEligible] = useState(null); // null | true | false
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();

  const checkEligible = async (e) => {
    e?.preventDefault();
    setErr(""); setMsg("");
    if (!userId.trim()) {
      setErr("Please enter your username.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await API.post("users/password/first-time/init/", {
        user_id: userId.trim(),
      });
      setEligible(!!data?.eligible);
      if (!data?.eligible) setErr("This account is not eligible for first-time setup.");
    } catch {
      setEligible(false);
      setErr("Could not verify. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!p1 || !p2) return setErr("Enter the new password twice.");
    if (p1 !== p2) return setErr("Passwords do not match.");
    setBusy(true);
    try {
      await API.post("users/password/first-time/complete/", {
        user_id: userId.trim(),
        password: p1,
      });
      setMsg("Password set! Redirecting to login…");
      setTimeout(() => nav("/"), 1200);
    } catch (ex) {
      const apiMsg = ex?.response?.data?.detail || "Unable to set password. Please try again.";
      setErr(apiMsg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-2">First-time password setup</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter your username to check if you can set your password now.
        </p>

        {/* Step 1: check */}
        <form onSubmit={checkEligible} className="space-y-4">
          <input
            type="text"
            value={userId}
            onChange={(e) => { setUserId(e.target.value); setEligible(null); setErr(""); setMsg(""); }}
            placeholder="Username"
            className="w-full px-4 py-2 border rounded-lg focus:outline-purple-600"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-70"
          >
            {busy ? "Checking…" : "Check"}
          </button>
        </form>

        {/* Step 2: set password (only if eligible) */}
        {eligible === true && (
          <form onSubmit={submitNewPassword} className="space-y-4 mt-6">
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
              disabled={busy}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-70"
            >
              {busy ? "Saving…" : "Set password"}
            </button>
          </form>
        )}

        {/* Messages */}
        {msg && <div className="mt-4 text-green-600">{msg}</div>}
        {err && <div className="mt-4 text-red-600">{err}</div>}
      </div>
    </div>
  );
}
