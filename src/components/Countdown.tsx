'use client';

import React, { useEffect, useState } from 'react';

interface CountdownProps {
  from?: number;
  onComplete: () => void;
}

export default function Countdown({ from = 3, onComplete }: CountdownProps) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (count <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-md animate-fadeIn">
      <div className="text-center space-y-4">
        <p className="text-sm uppercase tracking-widest text-orange-400 font-mono font-semibold">
          Host Started Quiz
        </p>
        <div className="relative flex items-center justify-center w-36 h-36 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-orange-500/30 animate-ping" />
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-orange-500/40 border border-orange-400">
            <span className="text-5xl font-black text-white font-mono animate-bounce">
              {count > 0 ? count : 'GO!'}
            </span>
          </div>
        </div>
        <p className="text-zinc-400 text-sm">Get ready for Question 1...</p>
      </div>
    </div>
  );
}
