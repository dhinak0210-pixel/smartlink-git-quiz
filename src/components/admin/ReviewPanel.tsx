// src/components/admin/ReviewPanel.tsx
// The admin review interface. Shows flagged students with evidence
// and Clear/Penalize/Disqualify decisions.

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Ban, RefreshCw, UserCheck } from 'lucide-react';

interface FlaggedStudent {
  student_id: string;
  name: string;
  college_id: string;
  trust_score: number;
  status: string;
  total_penalty: number;
  unresolved_flags: number;
  flag_types: string[];
  original_rank: number;
  total_points: number;
  adjusted_score: number;
}

interface Flag {
  id: string;
  student_id: string;
  flag_type: string;
  severity: string;
  evidence: Record<string, any>;
  score_penalty: number;
  is_resolved: boolean;
}

interface ReviewRecord {
  student_id: string;
  admin_name: string;
  decision: string;
  penalty: number;
  reason: string;
  created_at: string;
}

export function ReviewPanel() {
  const [students, setStudents] = useState<FlaggedStudent[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [decision, setDecision] = useState<'clear' | 'penalize' | 'disqualify'>('clear');
  const [penalty, setPenalty] = useState(200);
  const [reason, setReason] = useState('');
  const [adminName, setAdminName] = useState('Admin Master');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/flags');
      if (res.ok) {
        const data = await res.json();
        setStudents(data.flagged_students ?? []);
        setFlags(data.detailed_flags ?? []);
        setReviews(data.reviews ?? []);
      }
    } catch (err) {
      console.error('Error fetching flags:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  async function submitDecision() {
    if (!selectedStudent || !reason.trim() || !adminName.trim()) return;

    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      const studentFlags = flags.filter((f) => f.student_id === selectedStudent);
      const flagId = studentFlags.length > 0 ? studentFlags[0].id : null;

      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent,
          flag_id: flagId,
          decision,
          penalty: decision === 'penalize' ? penalty : 0,
          reason,
          admin_name: adminName,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to submit decision.');
      }

      setFeedbackMsg({ type: 'success', text: `Decision "${decision}" applied successfully!` });
      await fetchFlags();
      setSelectedStudent(null);
      setReason('');
      setPenalty(200);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Submission error.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-text-muted font-mono flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>Loading flagged students and audit data...</span>
      </div>
    );
  }

  const activeStudentObj = students.find((s) => s.student_id === selectedStudent);
  const studentFlags = selectedStudent
    ? flags.filter((f) => f.student_id === selectedStudent)
    : [];
  const studentReviews = selectedStudent
    ? reviews.filter((r) => r.student_id === selectedStudent)
    : [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <h2 className="text-2xl font-bold font-mono text-text flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-wrong" />
            <span>Anti-Cheat Review & Trust Panel</span>
          </h2>
          <p className="text-xs text-text-muted mt-1 font-sans">
            Human-in-the-loop review. Flags surface evidence, but organizers make the final binding determination.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchFlags();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-surface border border-surface-border hover:bg-surface-elevated text-text transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-lg text-sm font-medium ${
            feedbackMsg.type === 'success'
              ? 'bg-correct/10 border border-correct/30 text-correct'
              : 'bg-wrong/10 border border-wrong/30 text-wrong'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface border border-surface-border p-4 rounded-xl">
          <div className="text-xs text-text-muted font-mono uppercase">Held Students</div>
          <div className="text-2xl font-bold font-mono text-wrong mt-1">
            {students.filter((s) => s.status === 'held' || s.trust_score < 40).length}
          </div>
        </div>
        <div className="bg-surface border border-surface-border p-4 rounded-xl">
          <div className="text-xs text-text-muted font-mono uppercase">Needs Review</div>
          <div className="text-2xl font-bold font-mono text-git-orange mt-1">
            {students.filter((s) => s.status === 'review' || (s.trust_score >= 40 && s.trust_score < 70)).length}
          </div>
        </div>
        <div className="bg-surface border border-surface-border p-4 rounded-xl">
          <div className="text-xs text-text-muted font-mono uppercase">Unresolved Flags</div>
          <div className="text-2xl font-bold font-mono text-text mt-1">
            {flags.length}
          </div>
        </div>
        <div className="bg-surface border border-surface-border p-4 rounded-xl">
          <div className="text-xs text-text-muted font-mono uppercase">Audited Reviews</div>
          <div className="text-2xl font-bold font-mono text-correct mt-1">
            {reviews.length}
          </div>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <h3 className="text-base font-semibold font-mono text-text">
            Flagged Students Queue ({students.length})
          </h3>
          <span className="text-xs text-text-muted font-mono">Sorted by lowest Trust Score</span>
        </div>

        {students.length === 0 ? (
          <div className="p-8 text-center text-text-muted font-mono">
            <CheckCircle className="w-8 h-8 text-correct mx-auto mb-2 opacity-80" />
            <p>No students currently flagged for review. Arena integrity is clean!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated text-text-muted text-xs uppercase font-mono border-b border-surface-border">
                <tr>
                  <th className="text-left p-3">Orig Rank</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">College ID</th>
                  <th className="text-left p-3">Raw Score</th>
                  <th className="text-left p-3">Trust Score</th>
                  <th className="text-left p-3">Active Flags</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border font-mono">
                {students.map((s) => {
                  const isSelected = selectedStudent === s.student_id;
                  const isCritical = s.trust_score < 40 || s.status === 'held';
                  const isWarning = s.trust_score >= 40 && s.trust_score < 70;

                  return (
                    <tr
                      key={s.student_id}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-git-orange/10 border-l-4 border-git-orange'
                          : isCritical
                          ? 'bg-wrong/5 hover:bg-wrong/10'
                          : isWarning
                          ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                          : 'hover:bg-surface-elevated'
                      }`}
                      onClick={() => setSelectedStudent(s.student_id)}
                    >
                      <td className="p-3 font-semibold">#{s.original_rank}</td>
                      <td className="p-3 font-medium text-text">{s.name}</td>
                      <td className="p-3 text-text-muted">{s.college_id}</td>
                      <td className="p-3">{s.total_points}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                            s.trust_score >= 70
                              ? 'bg-correct/15 text-correct border border-correct/30'
                              : s.trust_score >= 40
                              ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30'
                              : 'bg-wrong/15 text-wrong border border-wrong/30'
                          }`}
                        >
                          {s.trust_score} / 100
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-text">{s.unresolved_flags}</span>
                        {s.flag_types && s.flag_types.length > 0 && (
                          <span className="text-xs text-text-muted ml-2">
                            ({s.flag_types.slice(0, 2).join(', ')}
                            {s.flag_types.length > 2 ? '...' : ''})
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-xs uppercase px-2 py-0.5 rounded font-bold ${
                            s.status === 'disqualified'
                              ? 'bg-red-900/40 text-red-400'
                              : s.status === 'held'
                              ? 'bg-wrong/20 text-wrong'
                              : s.status === 'review'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-correct/20 text-correct'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          className="px-3 py-1 bg-surface border border-surface-border text-git-orange hover:bg-git-orange hover:text-white rounded text-xs transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudent(s.student_id);
                          }}
                        >
                          Review Case
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal / Drawer */}
      {selectedStudent && activeStudentObj && (
        <div className="border border-surface-border rounded-xl p-5 bg-surface shadow-lg space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
            <div>
              <h3 className="text-lg font-bold font-mono text-text flex items-center gap-2">
                <span>Case Review: {activeStudentObj.name}</span>
                <span className="text-sm font-normal text-text-muted">({activeStudentObj.college_id})</span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5 font-mono">
                Original Rank #{activeStudentObj.original_rank} • Points: {activeStudentObj.total_points} • Adjusted Score: {activeStudentObj.adjusted_score}
              </p>
            </div>
            <button
              onClick={() => setSelectedStudent(null)}
              className="text-xs font-mono text-text-muted hover:text-text px-2 py-1 rounded bg-surface-elevated"
            >
              Close Panel ✕
            </button>
          </div>

          {/* Active Flags Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold font-mono text-text flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-git-orange" />
              <span>Flagged Evidence ({studentFlags.length}):</span>
            </h4>
            {studentFlags.length === 0 ? (
              <p className="text-xs text-text-muted font-mono italic">
                No active flags for this student (Status: {activeStudentObj.status}).
              </p>
            ) : (
              studentFlags.map((f) => (
                <div
                  key={f.id}
                  className={`p-3.5 rounded-lg border font-mono text-xs ${
                    f.severity === 'critical'
                      ? 'bg-wrong/10 border-wrong/30 text-wrong'
                      : f.severity === 'warning'
                      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{f.flag_type.replace(/_/g, ' ').toUpperCase()}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface border border-current">
                      {f.severity}
                    </span>
                  </div>
                  <pre className="text-[11px] mt-2 p-2 rounded bg-black/40 text-text overflow-x-auto max-h-36">
                    {JSON.stringify(f.evidence, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>

          {/* Decision Form */}
          <div className="space-y-4 pt-3 border-t border-surface-border">
            <h4 className="text-sm font-semibold font-mono text-text flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-correct" />
              <span>Organizer Decision & Audit Trail:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-text-muted mb-1">Reviewing Organizer Name:</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text font-mono focus:border-git-orange focus:outline-none"
                  placeholder="Organizer name"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-text-muted mb-1">Determination:</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision('clear')}
                    className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1 ${
                      decision === 'clear'
                        ? 'bg-correct text-white shadow'
                        : 'bg-surface-elevated text-text-muted border border-surface-border'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('penalize')}
                    className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1 ${
                      decision === 'penalize'
                        ? 'bg-yellow-500 text-white shadow'
                        : 'bg-surface-elevated text-text-muted border border-surface-border'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Penalize</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('disqualify')}
                    className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1 ${
                      decision === 'disqualify'
                        ? 'bg-wrong text-white shadow'
                        : 'bg-surface-elevated text-text-muted border border-surface-border'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Disqualify</span>
                  </button>
                </div>
              </div>
            </div>

            {decision === 'penalize' && (
              <div>
                <label className="block text-xs font-mono text-text-muted mb-1">Score Penalty Deduction (Points):</label>
                <input
                  type="number"
                  value={penalty}
                  onChange={(e) => setPenalty(Number(e.target.value))}
                  className="w-48 bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text font-mono focus:border-git-orange focus:outline-none"
                  min={50}
                  step={50}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-text-muted mb-1">Audit Justification & Reason (Required):</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-surface-elevated border border-surface-border rounded-lg p-3 text-sm text-text font-mono focus:border-git-orange focus:outline-none"
                rows={3}
                placeholder="Explain the rationale for this decision (e.g. Verified legitimate lightning reflexes; or repeated tab switching outside browser)..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 rounded-lg text-xs font-mono bg-surface-elevated text-text-muted hover:text-text border border-surface-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDecision}
                disabled={submitting || !reason.trim() || !adminName.trim()}
                className="px-6 py-2 rounded-lg text-xs font-mono font-bold bg-git-orange text-white hover:bg-git-orange-light disabled:opacity-50 transition shadow"
              >
                {submitting ? 'Recording Audit...' : 'Commit Binding Decision'}
              </button>
            </div>
          </div>

          {/* Past Review Audit Log */}
          {studentReviews.length > 0 && (
            <div className="pt-3 border-t border-surface-border space-y-2">
              <h5 className="text-xs font-bold font-mono text-text-muted uppercase">Past Review History for Student:</h5>
              {studentReviews.map((r, i) => (
                <div key={i} className="text-xs font-mono p-2.5 rounded bg-surface-elevated border border-surface-border">
                  <div className="flex justify-between text-text font-semibold">
                    <span>Decision: {r.decision.toUpperCase()} {r.penalty ? `(-${r.penalty} pts)` : ''}</span>
                    <span className="text-text-muted">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-text-muted mt-1">Reviewer: {r.admin_name} — Reason: {r.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
