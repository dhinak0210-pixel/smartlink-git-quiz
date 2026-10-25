import React from 'react';
import { Terminal, ShieldCheck, Zap } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-surface-border bg-surface/50 text-text-muted text-xs py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-text">
            <Terminal className="w-4 h-4 text-git-orange" />
            <span>SmartLink Git Quiz</span>
          </div>
          <span className="text-surface-border">|</span>
          <span className="flex items-center gap-1 text-[11px] text-correct">
            <Zap className="w-3 h-3" />
            Zero-Cost Production Stack (₹0)
          </span>
        </div>

        {/* Center / Fallback notice */}
        <div className="text-center font-mono text-[11px] text-text-muted">
          <span>Engineered for 200 concurrent student devices • Server-side timing & anti-cheat</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1 text-text-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-text-muted" />
            Secure
          </span>
        </div>
      </div>
    </footer>
  );
}
