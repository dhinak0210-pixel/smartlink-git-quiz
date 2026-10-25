// src/app/download/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Award,
  Trophy,
  Download,
  Printer,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface CertificateInfo {
  download_url: string;
  tier: 'winner' | 'participant';
  cert_id: string;
  cert_title: string;
  badge: string;
  citation: string;
  name: string;
  college_id: string; // Register Number
  rank: number;
  total_score: number;
}

export default function DownloadPage() {
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [registerNo, setRegisterNo] = useState('');
  const [cert, setCert] = useState<CertificateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check on mount for URL param ?college_id=... or authenticated student session
  useEffect(() => {
    async function checkAuth() {
      try {
        let targetUrl = '/api/certificates/download';
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const qId = params.get('college_id') || params.get('cid') || params.get('reg');
          if (qId) {
            targetUrl = `/api/certificates/download?college_id=${encodeURIComponent(qId.trim())}`;
            setRegisterNo(qId.trim());
          }
        }
        const res = await fetch(targetUrl);
        if (res.ok) {
          const data = await res.json();
          if (data && data.name) {
            setCert(data);
            setRegisterNo(data.college_id || '');
          }
        }
      } catch {
        // Not logged in or guest
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerNo.trim()) return;

    setSearchLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/certificates/download?college_id=${encodeURIComponent(registerNo.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Certificate not found. Please check your Register Number.');
      }

      setCert(data);
    } catch (err: any) {
      setError(err.message || 'Could not find certificate for this Register Number.');
      setCert(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!cert) return;
    setDownloading(true);
    try {
      const targetUrl = cert.download_url || `/api/certificates/view?college_id=${encodeURIComponent(cert.college_id)}`;
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cert.college_id}_certificate.pdf`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 200);
    } catch {
      window.location.href = `/api/certificates/view?college_id=${encodeURIComponent(cert.college_id)}`;
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isWinner = cert?.tier === 'winner';

  return (
    <main className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 sm:p-6 bg-[#0B0D13] text-white">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/final"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Leaderboard</span>
          </Link>
          <span className="text-xs font-mono text-zinc-500">SmartLink Git Quiz 2026</span>
        </div>

        {/* Search Bar for Register Number */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-orange-400" />
              <h1 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Certificate Portal
              </h1>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">
              Top 3 = Winner • All = Participation
            </span>
          </div>

          <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={registerNo}
                onChange={(e) => setRegisterNo(e.target.value)}
                placeholder="Enter Register Number / College ID (e.g. 21CS042)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 uppercase tracking-wider font-mono focus:outline-none focus:border-orange-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={searchLoading || !registerNo.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium text-xs font-mono transition shadow-sm cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{searchLoading ? 'Searching...' : 'Find Certificate'}</span>
            </button>
          </form>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Certificate Display Card */}
        {cert && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Download Buttons Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-zinc-300 font-medium">
                  Official certificate ready for download
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-mono transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-medium text-xs font-mono transition shadow-md cursor-pointer ${
                    isWinner
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40'
                      : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-950/40'
                  }`}
                >
                  <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-bounce' : ''}`} />
                  <span>{downloading ? 'Downloading...' : 'Download PDF'}</span>
                </button>
              </div>
            </div>

            {/* Visual Certificate Mockup */}
            <div
              id="printable-certificate"
              className={`relative rounded-3xl p-8 sm:p-12 text-center overflow-hidden border-4 shadow-2xl transition-all ${
                isWinner
                  ? 'bg-gradient-to-b from-[#161208] via-[#0E0C07] to-[#0A0906] border-amber-500/80 shadow-amber-500/10'
                  : 'bg-gradient-to-b from-[#081216] via-[#070D10] to-[#06080A] border-cyan-500/60 shadow-cyan-500/10'
              }`}
            >
              {/* Inner border line */}
              <div
                className={`absolute inset-3 border-2 rounded-2xl pointer-events-none ${
                  isWinner ? 'border-amber-500/30' : 'border-cyan-500/25'
                }`}
              />

              {/* Decorative Corner Ornaments */}
              <div
                className={`absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 ${
                  isWinner ? 'border-amber-400' : 'border-cyan-400'
                }`}
              />
              <div
                className={`absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 ${
                  isWinner ? 'border-amber-400' : 'border-cyan-400'
                }`}
              />
              <div
                className={`absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 ${
                  isWinner ? 'border-amber-400' : 'border-cyan-400'
                }`}
              />
              <div
                className={`absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 ${
                  isWinner ? 'border-amber-400' : 'border-cyan-400'
                }`}
              />

              {/* Header Badge */}
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center justify-center">
                  <div
                    className={`w-14 h-14 rounded-2xl border flex items-center justify-center shadow-lg ${
                      isWinner
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-amber-500/20'
                        : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-cyan-500/20'
                    }`}
                  >
                    {isWinner ? <Trophy className="w-7 h-7" /> : <Award className="w-7 h-7" />}
                  </div>
                </div>

                <div>
                  <div
                    className={`text-xs font-mono font-bold tracking-widest uppercase mb-1 ${
                      isWinner ? 'text-amber-400' : 'text-cyan-400'
                    }`}
                  >
                    SmartLink Git Championship 2026
                  </div>
                  <h2
                    className={`text-2xl sm:text-3xl font-black tracking-tight font-serif ${
                      isWinner ? 'text-amber-300' : 'text-white'
                    }`}
                  >
                    {cert.cert_title}
                  </h2>
                  <div
                    className={`inline-block mt-2 px-3.5 py-1 rounded-full text-xs font-mono font-semibold border ${
                      isWinner
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    }`}
                  >
                    {cert.badge}
                  </div>
                </div>

                <div className="text-xs text-zinc-400 font-serif italic pt-2">
                  This is officially presented to:
                </div>

                {/* Recipient Name */}
                <div className="py-2 border-b border-zinc-800/80 max-w-md mx-auto">
                  <h3 className="text-2xl sm:text-4xl font-extrabold text-white font-serif tracking-wide">
                    {cert.name}
                  </h3>
                </div>

                {/* Register Number / College ID */}
                <div className="font-mono text-sm font-semibold tracking-wider text-zinc-300 flex items-center justify-center gap-2">
                  <span>Register No:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-md font-bold ${
                      isWinner ? 'bg-amber-500/20 text-amber-300' : 'bg-cyan-500/20 text-cyan-300'
                    }`}
                  >
                    {cert.college_id}
                  </span>
                </div>

                {/* Citation Statement */}
                <p className="text-xs sm:text-sm text-zinc-300 max-w-lg mx-auto leading-relaxed pt-2">
                  {cert.citation}
                </p>

                {/* Rank & Score Pill */}
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-mono text-zinc-300">
                  <span className={isWinner ? 'text-amber-400 font-bold' : 'text-white font-bold'}>
                    {isWinner ? `Winner Rank: #${cert.rank}` : `Rank: #${cert.rank}`}
                  </span>
                  <span>•</span>
                  <span className="text-orange-400 font-semibold">{cert.total_score} Points</span>
                </div>

                {/* Signature / Metadata Footer */}
                <div className="pt-8 border-t border-zinc-800/80 grid grid-cols-2 gap-4 text-left text-[11px] font-mono text-zinc-400">
                  <div>
                    <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>SmartLink Engine</span>
                    </div>
                    <div className="text-zinc-500 mt-0.5">ID: {cert.cert_id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-zinc-300 font-medium">Tournament Final</div>
                    <div className="text-zinc-500 mt-0.5">Verified & Signed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
