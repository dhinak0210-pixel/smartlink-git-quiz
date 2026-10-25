import React from 'react';
import { ShieldAlert, AlertTriangle, UserX, Clock, Eye } from 'lucide-react';
import { CheatReportItem } from '@/lib/anti-cheat/server-analysis';

interface CheatAlertsProps {
  reports: CheatReportItem[];
  onBanStudent: (studentId: string) => void;
}

export function CheatAlerts({ reports, onBanStudent }: CheatAlertsProps) {
  const suspiciousReports = reports.filter((r) => r.risk_level !== 'low');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-wrong" />
          <h2 className="text-lg font-bold text-text font-mono">Suspicious Activity Alerts</h2>
        </div>
        <span className="text-xs font-mono text-text-muted">
          {suspiciousReports.length} Flagged Students
        </span>
      </div>

      {suspiciousReports.length === 0 ? (
        <div className="p-8 rounded-2xl border border-surface-border bg-surface text-center font-mono text-xs text-text-muted">
          No suspicious behavioral anomalies detected. All 200 participants operating within normal parameters.
        </div>
      ) : (
        <div className="space-y-3">
          {suspiciousReports.map((item) => (
            <div
              key={item.student_id}
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                item.risk_level === 'high'
                  ? 'border-wrong/50 bg-wrong/10'
                  : 'border-warning/40 bg-warning/10'
              }`}
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-text font-sans">{item.name}</span>
                  <span className="font-mono text-xs text-text-muted">{item.college_id}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      item.risk_level === 'high'
                        ? 'bg-wrong text-white'
                        : 'bg-warning text-black'
                    }`}
                  >
                    {item.risk_level} Risk
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-text-muted">
                  <span>Tab Switches: <strong className="text-text">{item.tab_switches}</strong></span>
                  <span>•</span>
                  <span>Window Blurs: <strong className="text-text">{item.window_blurs}</strong></span>
                  <span>•</span>
                  <span>Rapid Answers (&lt;1.5s): <strong className="text-text">{item.rapid_answers}</strong></span>
                </div>

                {item.flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.flags.map((flag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-background/80 border border-surface-border text-[11px] font-mono text-wrong"
                      >
                        ⚠️ {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onBanStudent(item.student_id)}
                  className="px-3 py-1.5 rounded-lg bg-wrong hover:bg-wrong/90 text-white font-mono text-xs font-bold transition flex items-center gap-1.5"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Disqualify</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
