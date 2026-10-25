'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Quiz ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-wrong/10 border border-wrong/30 flex items-center justify-center text-wrong mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-text mb-2 font-mono">Something went wrong</h2>
          <p className="text-sm text-text-muted max-w-md mb-6 font-sans">
            The quiz engine encountered an unexpected error. Your state and session are safely stored on the server.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-git-orange hover:bg-git-dark text-white font-medium text-sm transition-colors shadow-lg shadow-git-orange/20"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload Quiz</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
