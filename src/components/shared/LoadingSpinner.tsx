import React from 'react';
import { GitBranch } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ label = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 'w-5 h-5 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-3">
      <div className="relative">
        <GitBranch className={`${sizeMap[size].split(' ')[0]} ${sizeMap[size].split(' ')[1]} text-git-orange animate-spin`} />
        <div className="absolute inset-0 rounded-full border-2 border-git-orange border-t-transparent animate-spin" />
      </div>
      {label && <p className="text-text-muted font-mono text-sm tracking-wide">{label}</p>}
    </div>
  );
}
