// src/components/admin/WinnerVerificationWorkflow.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Trophy, ShieldCheck, Lock, Swords, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Award } from 'lucide-react';

interface VerificationStepState {
  freeze: { done: boolean; data?: any };
  compute_flags: { done: boolean; data?: any };
  review_top_10: { done: boolean; data?: any };
  apply_decisions: { done: boolean; data?: any };
  check_ties: { done: boolean; data?: any };
  confirm: { done: boolean; data?: any };
}

export function WinnerVerificationWorkflow() {
  const [adminName, setAdminName] = useState('Lead Organizer');
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [steps, setSteps] = useState<VerificationStepState>({
    freeze: { done: false },
    compute_flags: { done: false },
    review_top_10: { done: false },
    apply_decisions: { done: false },
    check_ties: { done: false },
    confirm: { done: false },
  });

  // Sudden-death round state
  const [suddenDeathQuestion, setSuddenDeathQuestion] = useState<any>(null);
  const [suddenDeathWinner, setSuddenDeathWinner] = useState<any>(null);

  async function executeStep(stepKey: string) {
    setLoadingStep(stepKey);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepKey, admin_name: adminName }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Step ${stepKey} failed.`);
      }

      setSteps((prev) => ({
        ...prev,
        [stepKey]: { done: true, data },
      }));
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification step failed.');
    } finally {
      setLoadingStep(null);
    }
  }

  async function triggerSuddenDeathStart() {
    setLoadingStep('sudden_death_start');
    try {
      const res = await fetch('/api/admin/sudden-death', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', round: 1 }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuddenDeathQuestion(data.question);
      } else {
        throw new Error(data.error || 'Failed to start sudden death');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoadingStep(null);
    }
  }

  const winners = steps.confirm.data?.winners ?? steps.apply_decisions.data?.top_3 ?? [];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <h2 className="text-2xl font-black font-mono text-text flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <span>Winner Verification Protocol (8-Step)</span>
          </h2>
          <p className="text-xs text-text-muted mt-1 font-sans">
            Guaranteed integrity: Frozen board, statistical audit, dual-organizer sign-off, and sudden-death tiebreakers.
          </p>
        </div>
        <div>
          <label className="text-[11px] font-mono text-text-muted block mb-1">Acting Organizer:</label>
          <input
            type="text"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-xs font-mono text-text focus:outline-none focus:border-git-orange"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-wrong/10 border border-wrong/30 rounded-xl text-wrong text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Steps List */}
      <div className="space-y-4">
        {/* Step 1: Freeze */}
        <div className={`p-4 rounded-xl border transition-all ${steps.freeze.done ? 'bg-surface border-correct/40' : 'bg-surface border-surface-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${steps.freeze.done ? 'bg-correct/20 text-correct' : 'bg-surface-elevated text-text-muted'}`}>
                1
              </div>
              <div>
                <h4 className="text-sm font-bold font-mono text-text">Freeze Leaderboard & Lock State</h4>
                <p className="text-xs text-text-muted">Transitions tournament status to finished and halts incoming answers.</p>
              </div>
            </div>
            <button
              onClick={() => executeStep('freeze')}
              disabled={loadingStep === 'freeze' || steps.freeze.done}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                steps.freeze.done
                  ? 'bg-correct/10 text-correct cursor-default'
                  : 'bg-git-orange text-white hover:bg-git-orange-light'
              }`}
            >
              {steps.freeze.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{steps.freeze.done ? 'Leaderboard Frozen' : 'Execute Freeze'}</span>
            </button>
          </div>
        </div>

        {/* Step 2: Compute / Verify Flags */}
        <div className={`p-4 rounded-xl border transition-all ${steps.compute_flags.done ? 'bg-surface border-correct/40' : 'bg-surface border-surface-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${steps.compute_flags.done ? 'bg-correct/20 text-correct' : 'bg-surface-elevated text-text-muted'}`}>
                2
              </div>
              <div>
                <h4 className="text-sm font-bold font-mono text-text">Verify Flag Computations</h4>
                <p className="text-xs text-text-muted">Ensures statistical speed, pairing, and tab-switch flags are generated.</p>
              </div>
            </div>
            <button
              onClick={() => executeStep('compute_flags')}
              disabled={loadingStep === 'compute_flags' || !steps.freeze.done || steps.compute_flags.done}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                steps.compute_flags.done
                  ? 'bg-correct/10 text-correct cursor-default'
                  : 'bg-git-orange text-white hover:bg-git-orange-light disabled:opacity-50'
              }`}
            >
              {steps.compute_flags.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{steps.compute_flags.done ? `Verified (${steps.compute_flags.data?.total_flags} Flags)` : 'Verify Flags'}</span>
            </button>
          </div>
        </div>

        {/* Step 3: Review Top 10 */}
        <div className={`p-4 rounded-xl border transition-all ${steps.review_top_10.done ? 'bg-surface border-correct/40' : 'bg-surface border-surface-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${steps.review_top_10.done ? 'bg-correct/20 text-correct' : 'bg-surface-elevated text-text-muted'}`}>
                3
              </div>
              <div>
                <h4 className="text-sm font-bold font-mono text-text">Audit Top 10 Contenders</h4>
                <p className="text-xs text-text-muted">Checks if all top-ranked finalists have their flags resolved or cleared.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/review"
                className="px-3 py-1.5 rounded-lg text-xs font-mono bg-surface-elevated text-git-orange border border-surface-border hover:bg-surface"
              >
                Open Review Panel ↗
              </Link>
              <button
                onClick={() => executeStep('review_top_10')}
                disabled={loadingStep === 'review_top_10' || !steps.compute_flags.done}
                className="px-4 py-2 rounded-lg text-xs font-mono font-bold bg-git-orange text-white hover:bg-git-orange-light disabled:opacity-50 transition"
              >
                {steps.review_top_10.done ? 'Re-Audit Top 10' : 'Audit Top 10'}
              </button>
            </div>
          </div>
          {steps.review_top_10.done && (
            <div className="mt-3 text-xs font-mono text-text-muted pt-2 border-t border-surface-border">
              {steps.review_top_10.data?.all_reviewed ? (
                <span className="text-correct font-semibold">✓ All Top 10 finalists have zero outstanding flags.</span>
              ) : (
                <span className="text-yellow-400 font-semibold">
                  ⚠️ {steps.review_top_10.data?.unresolved_count} unresolved flag(s) remaining among top 10 finalists.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Step 4: Apply Decisions & Recalculate */}
        <div className={`p-4 rounded-xl border transition-all ${steps.apply_decisions.done ? 'bg-surface border-correct/40' : 'bg-surface border-surface-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${steps.apply_decisions.done ? 'bg-correct/20 text-correct' : 'bg-surface-elevated text-text-muted'}`}>
                4
              </div>
              <div>
                <h4 className="text-sm font-bold font-mono text-text">Recalculate Standings (Post-Penalties)</h4>
                <p className="text-xs text-text-muted">Applies deductions and generates the verified leaderboard rankings.</p>
              </div>
            </div>
            <button
              onClick={() => executeStep('apply_decisions')}
              disabled={loadingStep === 'apply_decisions' || !steps.freeze.done}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition ${
                steps.apply_decisions.done ? 'bg-correct/10 text-correct' : 'bg-git-orange text-white hover:bg-git-orange-light'
              }`}
            >
              {steps.apply_decisions.done ? 'Rankings Calculated' : 'Apply Penalties & Rank'}
            </button>
          </div>
        </div>

        {/* Step 5: Check Ties & Sudden Death */}
        <div className={`p-4 rounded-xl border transition-all ${steps.check_ties.done ? 'bg-surface border-correct/40' : 'bg-surface border-surface-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${steps.check_ties.done ? 'bg-correct/20 text-correct' : 'bg-surface-elevated text-text-muted'}`}>
                5
              </div>
              <div>
                <h4 className="text-sm font-bold font-mono text-text">Tie-Breaker Verification</h4>
                <p className="text-xs text-text-muted">Detects 1st place score ties that require sudden death.</p>
              </div>
            </div>
            <button
              onClick={() => executeStep('check_ties')}
              disabled={loadingStep === 'check_ties' || !steps.apply_decisions.done}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition ${
                steps.check_ties.done ? 'bg-correct/10 text-correct' : 'bg-git-orange text-white hover:bg-git-orange-light'
              }`}
            >
              {steps.check_ties.done ? 'Ties Analyzed' : 'Check 1st Place Ties'}
            </button>
          </div>

          {steps.check_ties.done && steps.check_ties.data?.has_tie && (
            <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 font-bold text-yellow-400">
                <Swords className="w-4 h-4" />
                <span>1st Place Tie Detected! Sudden-Death Round Required</span>
              </div>
              <p className="text-text-muted">
                Tied Contestants: {steps.check_ties.data?.tied_students?.map((s: any) => `${s.name} (${s.final_score} pts)`).join(', ')}
              </p>
              <button
                onClick={triggerSuddenDeathStart}
                className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition"
              >
                Launch Reserve Sudden-Death Question
              </button>
              {suddenDeathQuestion && (
                <div className="p-3 bg-black/40 rounded border border-surface-border text-text">
                  <div className="font-bold mb-1">Sudden Death Q: {suddenDeathQuestion.text}</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {suddenDeathQuestion.options?.map((opt: any) => (
                      <li key={opt.id}>[{opt.label}] {opt.text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 6-7: Dual Signoff & Final Confirm */}
        <div className={`p-4 rounded-xl border transition-all ${steps.confirm.done ? 'bg-surface border-correct/40' : 'bg-surface border-surface-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${steps.confirm.done ? 'bg-correct/20 text-correct' : 'bg-surface-elevated text-text-muted'}`}>
                6
              </div>
              <div>
                <h4 className="text-sm font-bold font-mono text-text">Finalize & Reveal Winners (Podium)</h4>
                <p className="text-xs text-text-muted">Locks audit records and reveals confirmed top 3 champions to the projector.</p>
              </div>
            </div>
            <button
              onClick={() => executeStep('confirm')}
              disabled={loadingStep === 'confirm' || !steps.check_ties.done}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                steps.confirm.done ? 'bg-correct text-white shadow' : 'bg-git-orange text-white hover:bg-git-orange-light disabled:opacity-50'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>{steps.confirm.done ? 'Podium Certified' : 'Confirm & Reveal Champions'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Verified Podium Display */}
      {winners.length > 0 && (
        <div className="p-6 bg-surface border border-surface-border rounded-2xl shadow-xl space-y-4">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 font-mono text-xs font-bold">
              <Trophy className="w-3.5 h-3.5" />
              <span>OFFICIAL VERIFIED TOURNAMENT PODIUM</span>
            </div>
            <h3 className="text-xl font-black font-mono text-text">SmartLink Git Quiz Champions</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            {winners.slice(0, 3).map((w: any, idx: number) => {
              const place = idx + 1;
              const medalColor = place === 1 ? 'border-yellow-400 text-yellow-400' : place === 2 ? 'border-zinc-300 text-zinc-300' : 'border-amber-600 text-amber-600';
              return (
                <div
                  key={w.student_id || idx}
                  className={`p-5 rounded-2xl bg-surface-elevated border-2 ${medalColor} text-center space-y-2`}
                >
                  <div className="text-2xl font-black font-mono">#{place}</div>
                  <div className="font-bold text-base text-text">{w.name}</div>
                  <div className="text-xs font-mono text-text-muted">{w.college_id}</div>
                  <div className="text-lg font-black font-mono text-text pt-2 border-t border-surface-border">
                    {w.final_score} pts
                  </div>
                  <div className="text-[11px] font-mono text-text-muted">
                    {w.correct_count} correct answers
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
