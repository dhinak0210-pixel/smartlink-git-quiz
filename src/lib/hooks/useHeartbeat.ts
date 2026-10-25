// src/lib/hooks/useHeartbeat.ts
'use client';

import { useEffect, useRef } from 'react';

interface HeartbeatOptions {
  page: 'quiz' | 'lobby' | 'practice' | 'final';
  questionNumber?: number;
  tabSwitches?: number;
  intervalMs?: number;
}

export function useHeartbeat({
  page,
  questionNumber = 0,
  tabSwitches = 0,
  intervalMs = 12000,
}: HeartbeatOptions) {
  const qNumRef = useRef(questionNumber);
  const tabSwitchesRef = useRef(tabSwitches);

  useEffect(() => {
    qNumRef.current = questionNumber;
  }, [questionNumber]);

  useEffect(() => {
    tabSwitchesRef.current = tabSwitches;
  }, [tabSwitches]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sendHeartbeat = (isTabFocused: boolean, customPage?: string) => {
      try {
        const payload = JSON.stringify({
          page: customPage || page,
          question_number: qNumRef.current,
          is_tab_focused: isTabFocused,
          tab_switches: tabSwitchesRef.current,
        });

        fetch('/api/student/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {
          // Soft fail
        });
      } catch {
        // Soft fail
      }
    };

    // 1. Initial heartbeat
    sendHeartbeat(document.visibilityState === 'visible' && document.hasFocus());

    // 2. Periodic heartbeat
    const timer = setInterval(() => {
      const isFocused = document.visibilityState === 'visible' && document.hasFocus();
      sendHeartbeat(isFocused);
    }, intervalMs);

    // 3. Tab visibility change (sub-second telemetry on tab-switch)
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      sendHeartbeat(isVisible);
    };

    const handleFocus = () => sendHeartbeat(true);
    const handleBlur = () => sendHeartbeat(false);

    // 4. Departure beacon (when user closes tab or navigates away)
    const handleUnload = () => {
      try {
        const payload = JSON.stringify({
          page: 'left',
          question_number: qNumRef.current,
          is_tab_focused: false,
          tab_switches: tabSwitchesRef.current,
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/student/heartbeat', payload);
        }
      } catch {}
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [page, intervalMs]);
}
