"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useHeartbeat } from "@/lib/hooks/useHeartbeat";
import { supabase } from "@/lib/supabase/client";
import { Rocket, Sparkles, CheckCircle2, ShieldAlert } from "lucide-react";

export default function LobbyPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState("");
  const [studentName, setStudentName] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const redirectedRef = useRef(false);

  // Broadcast presence: Student is in lobby and ready
  useHeartbeat({ page: "lobby", intervalMs: 15000 });

  const triggerDirectStart = () => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    setIsStarting(true);
    // Directly enter the quiz arena
    router.replace("/quiz");
  };

  useEffect(() => {
    // 1. Fetch student info
    fetch("/api/student/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setStudentName(data.name);
      })
      .catch(() => router.push("/login"));

    // 2. Immediate check upon lobby entry (zero-delay transition if already started)
    const checkQuizStatus = async () => {
      try {
        const res = await fetch("/api/quiz/state", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "active" || data.status === "running") {
            triggerDirectStart();
            return true;
          }
        }
      } catch {}
      return false;
    };

    checkQuizStatus();

    // 3. Fast-polling heartbeat (every 1 second)
    const startChecker = setInterval(async () => {
      const active = await checkQuizStatus();
      if (active) clearInterval(startChecker);
    }, 1000);

    // 4. Supabase Realtime WebSocket listener for instant zero-latency start (<100ms)
    let channel: any = null;
    try {
      channel = supabase
        .channel("lobby-quiz-state-channel")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "quiz_state" },
          (payload: any) => {
            const status = payload?.new?.status;
            if (status === "active" || status === "running") {
              triggerDirectStart();
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[Lobby] Realtime channel setup error:", e);
    }

    // 5. Scheduled countdown timer
    const eventDate = new Date(process.env.NEXT_PUBLIC_EVENT_DATE || "2026-11-01T10:00:00+05:30");
    const timer = setInterval(() => {
      const now = new Date();
      const diff = eventDate.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown("Official Start Imminent...");
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setCountdown(`${h}h ${m}m ${s}s`);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(startChecker);
      if (channel) {
        try {
          channel.unsubscribe();
        } catch {}
      }
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {}
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {}
    window.location.href = "/login";
  };

  if (isStarting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4">
        <div className="text-center max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 animate-spin blur-lg opacity-40"></div>
            <div className="relative p-6 bg-zinc-900 border border-orange-500/50 rounded-2xl shadow-2xl">
              <Rocket className="w-12 h-12 text-orange-400 animate-bounce" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              <span>Quiz Started by Admin!</span>
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h2>
            <p className="text-sm font-mono text-zinc-400">
              Entering the Official Quiz Arena now... Question 1 is live!
            </p>
          </div>
          <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden border border-zinc-700/60">
            <div className="bg-gradient-to-r from-orange-500 to-amber-400 h-2 rounded-full animate-pulse w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="text-center max-w-lg">
        <h1 className="text-4xl font-bold mb-2">SmartLink Git Quiz</h1>
        {studentName && (
          <p className="text-gray-300 mb-8">Welcome, {studentName}!</p>
        )}

        <div className="bg-gray-800 rounded-xl p-8 mb-8 border border-gray-700/50 shadow-xl relative overflow-hidden">
          <div className="absolute top-2 right-3 flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Listener Active</span>
          </div>
          <p className="text-gray-400 mb-2">Waiting for Organizer to Start</p>
          <p className="text-4xl sm:text-5xl font-mono font-bold text-green-400 tracking-wider">
            {countdown || "Ready in Lobby"}
          </p>
          <p className="text-xs text-zinc-400 mt-3 font-mono">
            ⚡ When the admin clicks Start, you will automatically enter Question 1.
          </p>
        </div>

        <div className="text-sm text-gray-400 space-y-2 mb-6 text-left bg-gray-800/40 p-4 rounded-xl border border-gray-800">
          <p className="flex items-center gap-2">✅ <span className="text-gray-200">Session verified.</span> You are officially registered in the contestant queue.</p>
          <p className="flex items-center gap-2">⏱️ <span className="text-gray-200">15 Questions:</span> 5 Easy (Q1-5), 5 Medium (Q6-10), 5 Hard (Q11-15).</p>
          <p className="flex items-center gap-2">⚡ <span className="text-gray-200">20s per question:</span> Speed bonus awarded for faster correct answers.</p>
          <p className="flex items-center gap-2">🔒 <span className="text-gray-200">Strict Kiosk Lock:</span> Fullscreen fit is enforced. Exiting or switching tabs flags malpractice.</p>
        </div>

        {/* Quick Links while waiting */}
        <div className="grid grid-cols-2 gap-3 mb-8 text-xs font-medium">
          <a
            href="/final"
            className="p-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 transition flex items-center justify-center gap-2"
          >
            <span>🏆 Tournament Standings</span>
          </a>
          <a
            href="/projector"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition flex items-center justify-center gap-2"
          >
            <span>📺 Stage Projector View</span>
          </a>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-rose-400 transition-colors"
          >
            Switch Account / Log out
          </button>
          <span>•</span>
          <a href="/" className="hover:text-gray-300 transition-colors">
            Back to Tournament Portal
          </a>
        </div>
      </div>
    </div>
  );
}

