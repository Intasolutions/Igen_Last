import React, { useState } from "react";
import API from "../../api/axios";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState(""); // email or user_id
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const body = identifier.includes("@")
        ? { email: identifier.trim() }
        : { user_id: identifier.trim() };
      await API.post("users/password/forgot/", body);
      setMsg("If an account exists, a reset link has been sent.");
    } catch {
      setMsg("If an account exists, a reset link has been sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-2">Forgot your password?</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter your email or username to receive a reset link.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or Username"
            className="w-full px-4 py-2 border rounded-lg focus:outline-purple-600"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-70"
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
        {msg && <div className="mt-4 text-green-600">{msg}</div>}
      </div>
    </div>
  );
}
