'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QuestionCard, { QuestionData } from '@/components/QuestionCard';
import { getActiveQuestion, ActiveQuestionStatus } from '@/lib/quiz-timer';
import {
  Loader2,
  PauseCircle,
  AlertTriangle,
  Megaphone,
  Maximize2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Clock,
  Zap,
  Sparkles,
} from 'lucide-react';
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';
import { useAntiCheat } from '@/hooks/useAntiCheat';

export default function QuizPage() {
  const router = useRouter();

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [pauseOffsetMs, setPauseOffsetMs] = useState<number>(0);
  const [voidedQuestions, setVoidedQuestions] = useState<number[]>([]);
  const [quizStatus, setQuizStatus] = useState<string>('active');
  const [banner, setBanner] = useState<{ message: string; type: string } | null>(null);

  const [activeStatus, setActiveStatus] = useState<ActiveQuestionStatus | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState<boolean>(true);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fullscreen Lock & Malpractice State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showLockModal, setShowLockModal] = useState<boolean>(true);
  const [malpracticeStrikes, setMalpracticeStrikes] = useState<number>(0);
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);
  const [lastViolationType, setLastViolationType] = useState<string | null>(null);

  const currentQuestionNumberRef = useRef<number | null>(null);
  const hasEverLockedRef = useRef<boolean>(false);
  const isDisqualifiedRef = useRef<boolean>(false);
  const lastReportTimeRef = useRef<number>(0);

  // Real-time presence heartbeat
  useHeartbeat({
    page: 'quiz',
    questionNumber: activeStatus?.questionNumber || 1,
    intervalMs: 10000,
  });

  // Client anti-cheat listener
  const { warning } = useAntiCheat(Boolean(startedAt));

  // 1. Initial State Fetch & Clock Synchronization
  useEffect(() => {
    async function initQuiz() {
      try {
        const res = await fetch('/api/quiz/state', { cache: 'no-store' });
        if (!res.ok) {
          router.push('/lobby');
          return;
        }

        const data = await res.json();
        if (data.status === 'waiting' || !data.started_at) {
          router.push('/lobby');
          return;
        }

        if (data.status === 'ended' || data.status === 'finished') {
          if (data.fallbackUrl) {
            window.location.href = data.fallbackUrl;
            return;
          }
          router.push('/final');
          return;
        }

        const parsedStartedAt = new Date(data.started_at).getTime();
        const offset = data.serverTime
          ? new Date(data.serverTime).getTime() - Date.now()
          : data.server_time
          ? data.server_time - Date.now()
          : 0;

        setStartedAt(parsedStartedAt);
        setServerTimeOffset(offset);
        setPauseOffsetMs(data.pauseOffsetMs || 0);
        setVoidedQuestions(data.voidedQuestions || []);
        setQuizStatus(data.status);
        setBanner(data.banner || null);
      } catch (err) {
        console.error('[QuizPage] Init state error:', err);
        router.push('/lobby');
      }
    }

    initQuiz();
  }, [router]);

  // 2. State Polling (every 2.5s for pause, void, banner, and fallback updates)
  useEffect(() => {
    if (!startedAt) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/quiz/state', { cache: 'no-store' });
        if (!res.ok) return;

        const data = await res.json();
        if (data.fallbackUrl && data.status === 'ended') {
          window.location.href = data.fallbackUrl;
          return;
        }

        if (data.status === 'ended' || data.status === 'finished') {
          router.push('/final');
          return;
        }

        setQuizStatus(data.status);
        setPauseOffsetMs(data.pauseOffsetMs || 0);
        setVoidedQuestions(data.voidedQuestions || []);
        setBanner(data.banner || null);
      } catch (err) {
        // Soft fail
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [startedAt, router]);

  // 3. Fetch Question Data by position
  const fetchQuestion = useCallback(
    async (qNum: number) => {
      setLoadingQuestion(true);
      setErrorMessage(null);

      try {
        const res = await fetch(`/api/question/${qNum}`, { cache: 'no-store' });
        if (res.status === 401) {
          router.push('/login');
          return;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          setErrorMessage(errData?.error || `Unable to load question ${qNum}`);
          setLoadingQuestion(false);
          return;
        }

        const data: QuestionData = await res.json();
        setCurrentQuestion(data);
        currentQuestionNumberRef.current = qNum;
        setLoadingQuestion(false);
      } catch (err) {
        console.error(`[QuizPage] Fetch question ${qNum} error:`, err);
        setErrorMessage('Failed to connect to quiz server');
        setLoadingQuestion(false);
      }
    },
    [router]
  );

  // 4. Report Malpractice to Server when participant comes out of screen
  const reportMalpractice = useCallback(
    async (violationType: string) => {
      if (isDisqualifiedRef.current) return;
      if (!hasEverLockedRef.current) return;

      const now = Date.now();
      // Throttle reporting to avoid spamming within 2 seconds
      if (now - lastReportTimeRef.current < 2000) return;
      lastReportTimeRef.current = now;

      setIsFullscreen(false);
      setShowLockModal(true);
      setLastViolationType(violationType);

      try {
        const res = await fetch('/api/quiz/malpractice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: violationType,
            questionNumber: currentQuestionNumberRef.current || 1,
          }),
          keepalive: true,
        });

        const data = await res.json().catch(() => null);
        if (data?.strikeCount) {
          setMalpracticeStrikes(data.strikeCount);
          if (data.isDisqualified) {
            setIsDisqualified(true);
            isDisqualifiedRef.current = true;
          }
        } else {
          setMalpracticeStrikes((prev) => {
            const next = prev + 1;
            if (next >= 3) {
              setIsDisqualified(true);
              isDisqualifiedRef.current = true;
            }
            return next;
          });
        }
      } catch (err) {
        console.error('[QuizPage] Failed to log malpractice:', err);
        setMalpracticeStrikes((prev) => prev + 1);
      }
    },
    []
  );

  // 5. Fullscreen Lock & Kiosk Screen Exit Listeners
  useEffect(() => {
    const checkFullscreenState = () => {
      const inFullscreen = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
      );

      setIsFullscreen(inFullscreen);

      if (!inFullscreen) {
        if (hasEverLockedRef.current) {
          reportMalpractice('fullscreen_exit');
        } else {
          setShowLockModal(true);
        }
      } else {
        setShowLockModal(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && hasEverLockedRef.current) {
        reportMalpractice('tab_switch');
      }
    };

    const handleWindowBlur = () => {
      if (hasEverLockedRef.current && !document.hidden) {
        reportMalpractice('window_blur');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F11, F12, developer tools, view-source, reload
      if (
        e.key === 'F11' ||
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && ['c', 'v', 'u', 'i', 's', 'p', 'r'].includes(e.key.toLowerCase())) ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasEverLockedRef.current && !isDisqualifiedRef.current) {
        e.preventDefault();
        e.returnValue = 'Warning: Leaving or reloading the quiz will be recorded as MALPRACTICE.';
        return e.returnValue;
      }
    };

    // Attach listeners
    document.addEventListener('fullscreenchange', checkFullscreenState);
    document.addEventListener('webkitfullscreenchange', checkFullscreenState);
    document.addEventListener('mozfullscreenchange', checkFullscreenState);
    document.addEventListener('msfullscreenchange', checkFullscreenState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Initial check
    checkFullscreenState();

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreenState);
      document.removeEventListener('webkitfullscreenchange', checkFullscreenState);
      document.removeEventListener('mozfullscreenchange', checkFullscreenState);
      document.removeEventListener('msfullscreenchange', checkFullscreenState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [reportMalpractice]);

  // 6. Enter Fullscreen and Fit Screen
  const enterFullscreenLock = async () => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
      setShowLockModal(false);
      hasEverLockedRef.current = true;
    } catch (err) {
      console.warn('[QuizPage] Fullscreen request prevented by browser:', err);
      // Fallback fit screen mode
      setIsFullscreen(true);
      setShowLockModal(false);
      hasEverLockedRef.current = true;
    }
  };

  // 7. Quiz Timer Loop (running every 100ms for smooth client animation)
  useEffect(() => {
    if (!startedAt) return;

    const interval = setInterval(() => {
      const isPaused = quizStatus === 'paused';
      const status = getActiveQuestion(
        startedAt,
        serverTimeOffset,
        pauseOffsetMs,
        isPaused,
        voidedQuestions
      );

      setActiveStatus(status);

      if (status.phase === 'finished') {
        clearInterval(interval);
        router.push('/final');
        return;
      }

      if (status.phase === 'waiting') {
        if (currentQuestionNumberRef.current !== 1) {
          currentQuestionNumberRef.current = 1;
          fetchQuestion(1);
        }
        return;
      }

      if (status.phase !== 'paused') {
        if (status.questionNumber !== currentQuestionNumberRef.current) {
          currentQuestionNumberRef.current = status.questionNumber;
          fetchQuestion(status.questionNumber);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [startedAt, serverTimeOffset, pauseOffsetMs, quizStatus, voidedQuestions, fetchQuestion, router]);

  const handleAnswerSubmitted = (earnedPoints: number) => {
    setTotalScore((prev) => prev + earnedPoints);
  };

  if (!startedAt || !activeStatus || loadingQuestion || !currentQuestion) {
    return (
      <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center space-y-4 px-4 text-center z-50">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        <p className="text-sm font-mono text-zinc-400">
          {errorMessage || 'Synchronizing with quiz server clock...'}
        </p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-zinc-950 text-white select-none flex flex-col justify-between p-3 sm:p-5 z-20"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ─── FIT SCREEN TOP PROCTOR BAR ────────────────────────────────────── */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl backdrop-blur-md text-xs font-mono">
        {/* Left: Lock Status */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SCREEN LOCKED •</span> EXAM MODE
          </span>
          <span className="text-zinc-500 hidden md:inline">|</span>
          <span className="text-zinc-400 hidden md:inline">Q {activeStatus.questionNumber} of 15</span>
        </div>

        {/* Center: Live Malpractice Strike Tracker */}
        <div className="flex items-center gap-2">
          {malpracticeStrikes === 0 ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>0 Strikes (Clean)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/80 border border-red-500/60 text-red-300 animate-pulse font-bold">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>
                MALPRACTICE: Strike {malpracticeStrikes}/3 (-{malpracticeStrikes * 200} pts)
              </span>
            </span>
          )}
        </div>

        {/* Right: Score & Timer */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{totalScore.toLocaleString()} pts</span>
          </span>
          <button
            onClick={enterFullscreenLock}
            title="Fit screen to full window"
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── MAIN QUESTION ARENA (FIT SCREEN) ───────────────────────────────── */}
      <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col justify-center px-2 py-2 relative">
        {/* Broadcast Banner */}
        {banner && (
          <div className="mb-3 bg-amber-500/10 border border-amber-500/40 text-amber-200 px-4 py-2 rounded-xl flex items-center gap-2.5 text-xs shadow-lg animate-pulse">
            <Megaphone className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Organizer Announcement:</strong> {banner.message}
            </span>
          </div>
        )}

        {/* Void Notification */}
        {activeStatus.isVoided && (
          <div className="mb-3 bg-purple-950/40 border border-purple-500/40 text-purple-200 px-4 py-2 rounded-xl flex items-center gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong>Notice:</strong> Question #{activeStatus.questionNumber} has been voided by event organizers.
            </span>
          </div>
        )}

        {/* Anti-Cheat Warning */}
        {warning && (
          <div className="mb-3 bg-red-950/60 border border-red-500/60 text-red-200 px-4 py-2 rounded-xl flex items-center gap-2 text-xs animate-bounce shadow-lg">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>Anti-Cheat Notice:</strong> {warning}
            </span>
          </div>
        )}

        {/* Main Question Card */}
        <QuestionCard
          question={currentQuestion}
          totalScore={totalScore}
          phase={activeStatus.phase === 'result' ? 'result' : 'answering'}
          phaseTimeRemainingMs={activeStatus.timeRemainingMs}
          onAnswerSubmitted={handleAnswerSubmitted}
          onPhaseComplete={() => {}}
        />
      </div>

      {/* ─── BOTTOM SECURITY FOOTER ─────────────────────────────────────────── */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between text-[11px] font-mono text-zinc-500 px-2 py-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Kiosk Fullscreen Security Active
        </span>
        <span className="hidden sm:inline">SmartLink Anti-Malpractice System • Strict Proctored Mode</span>
      </div>

      {/* ─── MODAL 1: MANDATORY FULLSCREEN LOCK / MALPRACTICE VIOLATION OVERLAY ── */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          {isDisqualified ? (
            /* Disqualified State */
            <div className="bg-zinc-950 border-2 border-red-600 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center space-y-5 shadow-2xl shadow-red-950/80 animate-in fade-in zoom-in-95">
              <div className="w-20 h-20 rounded-full bg-red-950/80 border-2 border-red-500 flex items-center justify-center mx-auto text-red-400 shadow-xl">
                <Ban className="w-10 h-10 animate-pulse" />
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-red-950 border border-red-500/60 text-red-300">
                  Malpractice Disqualification
                </span>
                <h2 className="text-2xl font-extrabold text-white">Disqualified from Competition</h2>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  Your session has been terminated due to <strong>multiple screen exit violations (3/3 strikes)</strong>.
                  Your examination log and answers have been marked as <strong>MALPRACTICE</strong> and submitted to the lead
                  competition organizer for formal review.
                </p>
              </div>
              <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4 text-xs font-mono text-red-200/90 text-left space-y-1.5">
                <div>• Reason: Repeatedly exited locked fullscreen / window blur</div>
                <div>• Total Violations: {malpracticeStrikes} strikes</div>
                <div>• Official Status: DISQUALIFIED</div>
              </div>
              <button
                onClick={() => router.push('/final')}
                className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-2xl text-xs sm:text-sm transition-all"
              >
                Exit to Final Summary
              </button>
            </div>
          ) : malpracticeStrikes > 0 ? (
            /* Malpractice Strike Alert Modal */
            <div className="bg-zinc-950 border-2 border-red-500 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center space-y-5 shadow-2xl shadow-red-950/80 animate-in fade-in zoom-in-95">
              <div className="w-20 h-20 rounded-full bg-red-950/90 border-2 border-red-500 flex items-center justify-center mx-auto text-red-400 shadow-xl">
                <ShieldAlert className="w-10 h-10 animate-bounce" />
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-red-950 border border-red-500 text-red-300 animate-pulse">
                  <span>🚨 MALPRACTICE VIOLATION DETECTED</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Screen Exit Recorded</h2>
                <p className="text-xs sm:text-sm text-zinc-300">
                  You exited the locked fullscreen or switched windows. This incident has been logged as{' '}
                  <strong className="text-red-400">MALPRACTICE</strong> on the official organizer dashboard.
                </p>
              </div>

              {/* Violation Details */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-zinc-900 border border-red-500/40 p-3 rounded-2xl">
                  <span className="text-zinc-500 block">Strike Count</span>
                  <span className="text-red-400 font-extrabold text-base">
                    Strike {malpracticeStrikes} of 3
                  </span>
                </div>
                <div className="bg-zinc-900 border border-red-500/40 p-3 rounded-2xl">
                  <span className="text-zinc-500 block">Score Penalty</span>
                  <span className="text-amber-400 font-extrabold text-base">
                    -{malpracticeStrikes * 200} pts
                  </span>
                </div>
              </div>

              <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-2xl text-[11px] text-zinc-400 font-mono">
                ⚠️ Reaching 3 strikes results in instant, irreversible disqualification. Re-enter fullscreen immediately.
              </div>

              <button
                onClick={enterFullscreenLock}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-extrabold rounded-2xl text-sm transition-all shadow-xl shadow-red-950/60 flex items-center justify-center gap-2"
              >
                <Maximize2 className="w-5 h-5" />
                Re-Lock Screen & Return to Quiz
              </button>
            </div>
          ) : (
            /* Initial Fullscreen Lock Required Modal */
            <div className="bg-zinc-950 border border-orange-500/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center space-y-6 shadow-2xl shadow-orange-950/50 animate-in fade-in zoom-in-95">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500/20 to-amber-500/20 border border-orange-500/40 flex items-center justify-center mx-auto text-orange-400 shadow-xl">
                <Lock className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-orange-500/10 border border-orange-500/30 text-orange-400">
                  Official Exam Mode
                </span>
                <h2 className="text-2xl font-extrabold text-white">Screen Lock Required</h2>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  To ensure fair competition, this quiz requires an enforced <strong>Fullscreen Lock</strong>. The
                  quiz will fit your entire screen with all questions centered.
                </p>
              </div>

              {/* Rules Box */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 text-xs font-mono text-zinc-300 text-left space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Display fits screen completely with zero distractions</span>
                </div>
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Exiting fullscreen or switching tabs = MALPRACTICE</span>
                </div>
                <div className="flex items-center gap-2 text-red-400">
                  <Ban className="w-4 h-4 shrink-0" />
                  <span>3 Screen Exits = Automatic Disqualification</span>
                </div>
              </div>

              <button
                onClick={enterFullscreenLock}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold rounded-2xl text-sm transition-all shadow-xl shadow-orange-950/60 flex items-center justify-center gap-2"
              >
                <Maximize2 className="w-5 h-5" />
                Enter Fullscreen & Fit Screen
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── PAUSED OVERLAY ─────────────────────────────────────────────────── */}
      {quizStatus === 'paused' && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
            <PauseCircle className="w-16 h-16 text-amber-400 mx-auto animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">Quiz Temporarily Paused</h2>
            <p className="text-sm text-zinc-300">
              Event organizers have paused the competition. Your timers and submissions are held.
            </p>
            <div className="bg-zinc-800/60 p-3 rounded-xl text-xs text-amber-300/90 font-mono">
              Do not refresh or exit fullscreen. The quiz will resume automatically.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
