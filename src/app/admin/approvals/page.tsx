'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

interface ApprovalItem {
  id: string;
  event_id: string;
  action: string;
  payload: any;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function AdminApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/approvals');
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
        setCurrentAdminId(data.currentAdminId || '');
      }
    } catch {
      // Soft fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleDecision = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setActionLoading(approvalId);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId,
          decision,
          rejectionReason: decision === 'rejected' ? 'Rejected by co-organizer review' : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`Approval request #${approvalId.slice(0, 8)} marked as ${decision}.`);
        await fetchApprovals();
      } else {
        alert(data.error || 'Decision failed');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
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
                <ShieldCheck className="w-6 h-6 text-orange-400" />
                Two-Person Approvals Queue
              </h1>
              <p className="text-xs text-zinc-400">
                Critical actions (voiding questions, disqualifications, winner selection) require two independent organizers
              </p>
            </div>
          </div>

          <button
            onClick={fetchApprovals}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>

        {message && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{message}</span>
          </div>
        )}

        {/* Pending Queue List */}
        <div className="space-y-4">
          {approvals.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-semibold text-white">Approvals Queue is Clear</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                No high-impact actions are currently pending secondary authorization.
              </p>
            </div>
          ) : (
            approvals.map((req) => {
              const isRequester = req.requested_by === currentAdminId;
              return (
                <div
                  key={req.id}
                  className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold uppercase bg-amber-950/60 text-amber-300 border border-amber-800/60">
                        {req.action}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        ID: {req.id.slice(0, 8)}...
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(req.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-xs space-y-2">
                    <div className="text-zinc-300">
                      <strong>Payload Details:</strong>
                      <pre className="mt-1 p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                        {JSON.stringify(req.payload, null, 2)}
                      </pre>
                    </div>
                    {isRequester && (
                      <p className="text-[11px] text-amber-400 italic">
                        ⚠️ You submitted this request. A second distinct organizer must review and approve it.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/60">
                    <button
                      disabled={isRequester || actionLoading === req.id}
                      onClick={() => handleDecision(req.id, 'rejected')}
                      className="px-4 py-2 bg-zinc-800 hover:bg-rose-950/50 text-rose-300 border border-zinc-700 hover:border-rose-700/60 disabled:opacity-40 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> Reject Request
                    </button>
                    <button
                      disabled={isRequester || actionLoading === req.id}
                      onClick={() => handleDecision(req.id, 'approved')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Second Sign-Off / Approve
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
