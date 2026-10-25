"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    joinCode: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Reset failed.");
        return;
      }

      setSuccess(data.message);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter your email and the join code from your registration email.
          No verification email will be sent.
        </p>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="yourname@klu.ac.in"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Join Code</label>
            <input
              type="text"
              required
              maxLength={6}
              value={form.joinCode}
              onChange={(e) => setForm({ ...form, joinCode: e.target.value.toUpperCase() })}
              className="w-full border rounded px-3 py-2 font-mono tracking-widest"
              placeholder="e.g. A3K9P2"
            />
          </div>
          <PasswordInput
            label="New Password"
            value={form.newPassword}
            onChange={(v) => setForm({ ...form, newPassword: v })}
            minLength={8}
          />
          <PasswordInput
            label="Confirm New Password"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <p className="text-sm text-center mt-4">
          <a href="/login" className="text-blue-600 hover:underline">Back to login</a>
        </p>
      </div>
    </div>
  );
}
