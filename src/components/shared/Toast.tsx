'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose?: () => void;
}

export function Toast({ type, message, onClose }: ToastProps) {
  const styles = {
    success: 'bg-correct/10 border-correct/30 text-correct',
    error: 'bg-wrong/10 border-wrong/30 text-wrong',
    info: 'bg-git-orange/10 border-git-orange/30 text-git-orange',
  };

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 shrink-0" />,
    info: <Info className="w-4 h-4 shrink-0" />,
  };

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl text-xs font-mono animate-in fade-in slide-in-from-bottom-2 ${styles[type]}`}
    >
      {icons[type]}
      <span className="text-text">{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-2 hover:opacity-80 text-text-muted">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
