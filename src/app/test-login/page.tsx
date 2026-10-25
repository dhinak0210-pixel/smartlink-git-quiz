"use client";

import React, { useState } from "react";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import { CheckCircle2, ShieldCheck, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";

export default function TestLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedStudent, setVerifiedStudent] = useState<{
    name?: string;
    role?: string;
    email?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifiedStudent(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          isTestLogin: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed. Check your email and password.");
        return;
      }

      setVerifiedStudent({
        name: data.role === "admin" ? "Organizer / Admin" : "Participant",
        role: data.role,
        email: email.trim(),
      });
    } catch (err: any) {
      setError("Network or server connection failed. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white flex flex-col justify-between p-4 sm:p-6">
      <header className="max-w-md w-full mx-auto flex items-center justify-between py-4">
        <Link
          href="/login"
          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Official Login
        </Link>
        <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
          Pre-Event Day Check
        </span>
      </header>

      <main className="max-w-md w-full mx-auto my-auto">
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Test Login Verification</h1>
              <p className="text-xs text-zinc-400">
                Verify your credentials safely before the live event
              </p>
            </div>
          </div>

          <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-3.5 mb-6 text-xs text-zinc-300 space-y-1.5">
            <p className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <span>ℹ️</span> Pre-Event Testing Notice:
            </p>
            <p>
              This portal checks that your registered email and password authenticate successfully.
              It will <strong>not</strong> start a quiz session or kick active sessions.
            </p>
          </div>

          {verifiedStudent ? (
            <div className="space-y-6">
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-5 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-white mb-1">
                  Credentials Verified!
                </h2>
                <p className="text-xs text-emerald-200/80 mb-3">
                  Your account is registered and ready for the SmartLink Git Quiz competition.
                </p>
                <div className="bg-zinc-900/80 rounded-lg p-3 text-left font-mono text-xs text-zinc-300 border border-zinc-800 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Account:</span>
                    <span className="text-zinc-200">{verifiedStudent.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Role:</span>
                    <span className="text-emerald-400 font-semibold uppercase">{verifiedStudent.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Status:</span>
                    <span className="text-emerald-400">Ready for Live Event</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setVerifiedStudent(null);
                    setPassword("");
                  }}
                  className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl transition-colors"
                >
                  Test Another Account
                </button>
                <Link
                  href="/login"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl text-center transition-colors shadow-lg shadow-emerald-900/30"
                >
                  Proceed to Official Login Portal
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-rose-950/40 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Registered Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. 2100030000@klu.ac.in"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <PasswordInput
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  required
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Verify My Credentials</span>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-zinc-500 py-4">
        SmartLink Git Quiz &bull; Pre-Event Verification Portal
      </footer>
    </div>
  );
}
