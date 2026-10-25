"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import BarcodeScanner from "@/components/BarcodeScanner";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    registerNo: "",
    password: "",
    confirmPassword: "",
    joinCode: "",
    consent: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Sign-up failed.");
        return;
      }

      if (data.needsLogin) {
        router.push("/login?message=Account created. Please log in.");
      } else {
        router.push(data.redirect || "/lobby");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScan = (registerNo: string) => {
    setForm((f) => ({ ...f, registerNo }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-2">Create Your Account</h1>
        <p className="text-sm text-gray-500 mb-6">
          Only registered students can sign up. Use the join code from your email.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="As it should appear on your certificate"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">College Email *</label>
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
            <label className="block text-sm font-medium mb-1">Register Number *</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={form.registerNo}
                onChange={(e) => setForm({ ...form, registerNo: e.target.value })}
                className="flex-1 border rounded px-3 py-2"
                placeholder="e.g., 21KL1A0501"
              />
              <BarcodeScanner onScan={handleBarcodeScan} />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Scan your ID card barcode or type manually.
            </p>
          </div>

          <PasswordInput
            label="Password *"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            minLength={8}
          />

          <PasswordInput
            label="Confirm Password *"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
          />

          <div>
            <label className="block text-sm font-medium mb-1">Join Code *</label>
            <input
              type="text"
              required
              maxLength={6}
              value={form.joinCode}
              onChange={(e) =>
                setForm({ ...form, joinCode: e.target.value.toUpperCase() })
              }
              className="w-full border rounded px-3 py-2 font-mono tracking-widest"
              placeholder="e.g., A3K9P2"
            />
            <p className="text-xs text-gray-400 mt-1">
              6-character code from your registration email.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={form.consent}
              onChange={(e) => setForm({ ...form, consent: e.target.checked })}
              className="mt-1"
            />
            <span>
              I agree to the collection and processing of my data for this quiz event.
              I understand my results may be displayed on a leaderboard.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-center mt-4 text-gray-500">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:underline font-medium">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
