// src/lib/anti-cheat/monitor.ts
// Runs in the browser during the quiz.
// Captures behavioral signals and batches them to the server.

export interface CheatEvent {
  type: string;
  questionPosition: number;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export class AntiCheatMonitor {
  private events: CheatEvent[] = [];
  private isRunning = false;
  private currentQuestion = 0;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private tabSwitchCount = 0;
  private isHidden = false;
  private hiddenAt = 0;

  // Configuration
  private readonly FLUSH_INTERVAL_MS = 8000;  // Send batch every 8 seconds
  private readonly MAX_BATCH_SIZE = 20;        // Or when batch reaches 20 events

  /**
   * Start monitoring. Call when the quiz begins.
   */
  start(): void {
    if (this.isRunning || typeof window === 'undefined') return;
    this.isRunning = true;
    this.tabSwitchCount = 0;

    // 1. Tab / App Switch Detection
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('focus', this.handleFocus);

    // 2. Copy / Paste / Right-Click Blocking
    document.addEventListener('copy', this.handleCopy, true);
    document.addEventListener('cut', this.handleCut, true);
    document.addEventListener('paste', this.handlePaste, true);
    document.addEventListener('contextmenu', this.handleContextMenu, true);

    // 3. Keyboard Shortcut Blocking
    document.addEventListener('keydown', this.handleKeyDown, true);

    // 4. Fullscreen Exit Detection (desktop only)
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);

    // 5. Page Reload Detection
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    // 6. Periodic flush
    this.flushInterval = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);

    this.log('monitor_started', {});
  }

  /**
   * Stop monitoring. Call when the quiz ends.
   */
  stop(): void {
    if (!this.isRunning || typeof window === 'undefined') return;
    this.isRunning = false;

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('focus', this.handleFocus);
    document.removeEventListener('copy', this.handleCopy, true);
    document.removeEventListener('cut', this.handleCut, true);
    document.removeEventListener('paste', this.handlePaste, true);
    document.removeEventListener('contextmenu', this.handleContextMenu, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.flush(); // Final flush
  }

  /**
   * Update the current question number (called by the quiz UI).
   */
  setQuestion(position: number): void {
    this.currentQuestion = position;
  }

  // ─── Event Handlers ──────────────────────────────────

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.isHidden = true;
      this.hiddenAt = Date.now();
      this.tabSwitchCount++;
      this.log('tab_switch', {
        switch_number: this.tabSwitchCount,
        action: 'hidden',
      });

      // Show warning on first switch
      if (this.tabSwitchCount === 1) {
        this.showWarning(
          '⚠️ Tab switch detected. This is a warning. ' +
          'Further switches will result in point deductions.'
        );
      } else if (this.tabSwitchCount === 2) {
        this.showWarning(
          '🚨 Second tab switch! 200 points have been deducted. ' +
          'A third switch will flag your account for review.'
        );
      }
    } else {
      if (this.isHidden) {
        const durationMs = Date.now() - this.hiddenAt;
        this.log('tab_return', {
          switch_number: this.tabSwitchCount,
          away_duration_ms: durationMs,
        });
        this.isHidden = false;
      }
    }
  };

  private handleBlur = (): void => {
    // Only log if not already hidden (avoid double-counting with visibilitychange)
    if (!this.isHidden) {
      this.log('window_blur', {});
    }
  };

  private handleFocus = (): void => {
    this.log('window_focus', {});
  };

  private handleCopy = (e: Event): void => {
    e.preventDefault();
    this.log('copy_blocked', { question: this.currentQuestion });
  };

  private handleCut = (e: Event): void => {
    e.preventDefault();
    this.log('cut_blocked', { question: this.currentQuestion });
  };

  private handlePaste = (e: Event): void => {
    e.preventDefault();
    this.log('paste_blocked', { question: this.currentQuestion });
  };

  private handleContextMenu = (e: Event): void => {
    e.preventDefault();
    this.log('contextmenu_blocked', { question: this.currentQuestion });
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Block common cheating shortcuts
    const blocked = [
      e.key === 'F12', // DevTools
      e.ctrlKey && ['c', 'v', 'u', 'i', 'j', 'a'].includes(e.key.toLowerCase()), // Ctrl+C/V/U/I/J/A
      e.metaKey && ['c', 'v', 'u', 'i', 'j', 'a'].includes(e.key.toLowerCase()), // Cmd+C/V/U/I/J/A
      e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()), // DevTools shortcuts
    ];

    if (blocked.some(Boolean)) {
      e.preventDefault();
      e.stopPropagation();
      this.log('shortcut_blocked', {
        key: e.key,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
      });
    }
  };

  private handleFullscreenChange = (): void => {
    if (typeof document !== 'undefined' && !document.fullscreenElement) {
      this.log('fullscreen_exit', {});
    }
  };

  private handleBeforeUnload = (): void => {
    // Use sendBeacon for reliability during page unload
    this.log('page_reload', { question: this.currentQuestion });
    this.flushBeacon();
  };

  // ─── Logging ─────────────────────────────────────────

  private log(type: string, metadata: Record<string, unknown>): void {
    this.events.push({
      type,
      questionPosition: this.currentQuestion,
      timestamp: Date.now(),
      metadata,
    });

    // Auto-flush if batch is full
    if (this.events.length >= this.MAX_BATCH_SIZE) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const batch = [...this.events];
    this.events = [];

    try {
      await fetch('/api/events/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } catch {
      // If flush fails, re-add events to the queue (don't lose data)
      this.events.unshift(...batch);
      // Cap the queue to prevent memory issues
      if (this.events.length > 100) {
        this.events = this.events.slice(-100);
      }
    }
  }

  private flushBeacon(): void {
    if (this.events.length === 0 || typeof navigator === 'undefined') return;
    const data = JSON.stringify({ events: this.events });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/events/log', data);
    }
    this.events = [];
  }

  private showWarning(message: string): void {
    if (typeof window === 'undefined') return;
    // Dispatch a custom event that the React UI can listen to
    window.dispatchEvent(
      new CustomEvent('quiz-warning', { detail: { message } })
    );
  }
}

// Singleton
export const antiCheatMonitor = new AntiCheatMonitor();
