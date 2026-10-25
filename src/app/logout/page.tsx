'use client';

import { useEffect } from 'react';

export default function LogoutPage() {
  useEffect(() => {
    async function doLogout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {}
      try {
        await fetch('/api/logout', { method: 'POST' });
      } catch {}
      try {
        sessionStorage.clear();
        localStorage.clear();
      } catch {}
      window.location.href = '/login';
    }
    doLogout();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-zinc-300 font-mono text-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p>Logging out and clearing session...</p>
      </div>
    </div>
  );
}
