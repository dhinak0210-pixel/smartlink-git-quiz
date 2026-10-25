'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Settings,
  ArrowLeft,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Save,
  Shield
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formValues, setFormValues] = useState({
    seconds_per_question: 20,
    gap_seconds: 5,
    total_questions: 15,
    emergency_form_url: '',
    speed_bonus_max: 300,
    signup_open_days_before: 10,
    signup_close_days_before: 1,
  });

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data.values) {
          setFormValues({
            seconds_per_question: data.values.seconds_per_question || 20,
            gap_seconds: data.values.gap_seconds || 5,
            total_questions: data.values.total_questions || 15,
            emergency_form_url: data.values.emergency_form_url || '',
            speed_bonus_max: data.values.speed_bonus_max || 300,
            signup_open_days_before: data.values.signup_open_days_before || 10,
            signup_close_days_before: data.values.signup_close_days_before || 1,
          });
        }
      }
    } catch {
      // Soft fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: formValues }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Settings saved successfully.');
        await fetchSettings();
      } else {
        setError(data.error || 'Failed to save settings.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFreeze = async () => {
    if (!confirm('Freeze configuration settings? Once frozen, values cannot be edited without authorization.')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'freeze', bankHash: 'sha256_bank_freeze_active' }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Configuration successfully frozen.');
        await fetchSettings();
      } else {
        setError(data.error || 'Freeze failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  const isFrozen = Boolean(settings?.frozen_at);

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Settings className="w-6 h-6 text-orange-400" />
                Event Configuration & Parameters
              </h1>
              <p className="text-xs text-zinc-400">
                Timing parameters, scoring formula constants, and emergency endpoints
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isFrozen && (
              <button
                type="button"
                onClick={handleFreeze}
                disabled={saving}
                className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                Freeze Settings
              </button>
            )}
            <Link
              href="/admin/dashboard"
              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-semibold text-white transition-colors"
            >
              Done
            </Link>
          </div>
        </div>

        {/* Lock Status Banner */}
        {isFrozen ? (
          <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-2xl flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-xs text-amber-200">
              <strong>Settings Frozen:</strong> Parameters are locked for official event integrity.
              Frozen at {new Date(settings.frozen_at).toLocaleString()}.
            </div>
          </div>
        ) : (
          <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl flex items-center gap-3">
            <Unlock className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs text-emerald-200">
              <strong>Settings Unlocked:</strong> Parameters can be adjusted before the competition begins.
            </div>
          </div>
        )}

        {message && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Settings Form */}
        <form onSubmit={handleSave} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Seconds per Question
              </label>
              <input
                type="number"
                disabled={isFrozen || saving}
                value={formValues.seconds_per_question}
                onChange={(e) => setFormValues({ ...formValues, seconds_per_question: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 font-mono"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">Default: 20 seconds</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Gap / Result Duration (Seconds)
              </label>
              <input
                type="number"
                disabled={isFrozen || saving}
                value={formValues.gap_seconds}
                onChange={(e) => setFormValues({ ...formValues, gap_seconds: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 font-mono"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">Default: 5 seconds</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Total Questions in Official Tournament
              </label>
              <input
                type="number"
                disabled={isFrozen || saving}
                value={formValues.total_questions}
                onChange={(e) => setFormValues({ ...formValues, total_questions: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 font-mono"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">Default: 15 questions</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Max Speed Bonus Points
              </label>
              <input
                type="number"
                disabled={isFrozen || saving}
                value={formValues.speed_bonus_max}
                onChange={(e) => setFormValues({ ...formValues, speed_bonus_max: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 font-mono"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">Default: 300 points</span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Emergency Fallback Google Form URL
              </label>
              <input
                type="url"
                disabled={isFrozen || saving}
                value={formValues.emergency_form_url}
                onChange={(e) => setFormValues({ ...formValues, emergency_form_url: e.target.value })}
                placeholder="https://forms.google.com/..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 font-mono"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">Activated automatically if emergency kill-switch is engaged</span>
            </div>
          </div>

          {!isFrozen && (
            <div className="flex justify-end pt-4 border-t border-zinc-800">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-orange-950/40"
              >
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
