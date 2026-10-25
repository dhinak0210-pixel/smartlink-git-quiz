/**
 * Client-Side Anti-Cheat Monitoring
 * Detects tab switching, window blur, copy/paste attempts, right clicks, and devtools shortcuts.
 * Events are buffered and flushed to /api/anti-cheat/log.
 */

interface QueuedCheatEvent {
  type: string;
  metadata: Record<string, any>;
  occurred_at: string;
}

let cheatBuffer: QueuedCheatEvent[] = [];
let flushIntervalId: any = null;
let isMonitoring = false;
let currentQuestionNumber = 0;

export function updateAntiCheatQuestion(qNum: number) {
  currentQuestionNumber = qNum;
}

async function flushCheatBuffer() {
  if (cheatBuffer.length === 0) return;

  const eventsToSend = [...cheatBuffer];
  cheatBuffer = [];

  try {
    await fetch('/api/anti-cheat/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: eventsToSend,
        question_number: currentQuestionNumber,
      }),
    });
  } catch {
    // If flush fails, re-queue events (up to a safe limit)
    if (cheatBuffer.length < 20) {
      cheatBuffer = [...eventsToSend, ...cheatBuffer];
    }
  }
}

export function queueCheatEvent(type: string, metadata: Record<string, any> = {}) {
  cheatBuffer.push({
    type,
    metadata: { ...metadata, question_number: currentQuestionNumber },
    occurred_at: new Date().toISOString(),
  });

  if (cheatBuffer.length >= 5) {
    flushCheatBuffer();
  }
}

export function startAntiCheatMonitor() {
  if (typeof window === 'undefined' || isMonitoring) return;
  isMonitoring = true;

  // 1. Tab visibility change
  const onVisibilityChange = () => {
    if (document.hidden) {
      queueCheatEvent('tab_switch', { state: 'hidden' });
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // 2. Window blur (leaving window / multi-monitor or alt-tab)
  const onBlur = () => {
    queueCheatEvent('window_blur', {});
  };
  window.addEventListener('blur', onBlur);

  // 3. Copy / cut / paste prevention
  const onCopy = (e: ClipboardEvent) => {
    e.preventDefault();
    queueCheatEvent('copy_attempt', {});
  };
  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault();
    queueCheatEvent('copy_attempt', { action: 'paste' });
  };
  document.addEventListener('copy', onCopy);
  document.addEventListener('paste', onPaste);

  // 4. Right-click context menu prevention
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    queueCheatEvent('right_click', {});
  };
  document.addEventListener('contextmenu', onContextMenu);

  // 5. Keyboard shortcut prevention (Ctrl+C, Ctrl+V, Ctrl+U, Ctrl+Shift+I, F12)
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'u', 'i', 's', 'p'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      queueCheatEvent('keyboard_shortcut', { key: e.key });
    }
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key))) {
      e.preventDefault();
      queueCheatEvent('devtools_attempt', { key: e.key });
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Periodic flush every 8 seconds
  flushIntervalId = setInterval(flushCheatBuffer, 8000);

  // Cleanup handler
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('paste', onPaste);
    document.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('keydown', onKeyDown);
    if (flushIntervalId) clearInterval(flushIntervalId);
    flushCheatBuffer();
    isMonitoring = false;
  };
}
