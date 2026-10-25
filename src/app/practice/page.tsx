// src/app/practice/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PracticeModePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/lobby');
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-xl">
        <div className="w-12 h-12 mx-auto rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
          🏆
        </div>
        <h2 className="text-xl font-bold text-white">Practice Mode Retired</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Practice mode has been removed for the Official Championship Tournament. Redirecting you to the contestant lobby...
        </p>
        <div className="pt-2">
          <Link
            href="/lobby"
            className="inline-block px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-semibold text-xs transition"
          >
            Go to Contestant Lobby
          </Link>
        </div>
      </div>
    </div>
  );
}
