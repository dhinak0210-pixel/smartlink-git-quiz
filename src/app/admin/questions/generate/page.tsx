'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AIGenerator } from '@/components/admin/AIGenerator';
import { ArrowLeft, ListOrdered } from 'lucide-react';

export default function AdminGenerateQuestionsPage() {
  const router = useRouter();

  const handleImport = async (newQuestions: any[]) => {
    try {
      const res = await fetch('/api/question/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true, questions: newQuestions }),
      });
      if (!res.ok) throw new Error('Import failed');
      alert(`Successfully added ${newQuestions.length} AI-generated questions to the bank!`);
      router.push('/admin/questions');
    } catch (err: any) {
      alert('Import error: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/questions"
              className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              title="Back to Question Bank"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono flex items-center gap-2">
                <span>AI Question Synthesizer</span>
              </h1>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Generate and validate fresh technical tournament questions via Gemini &amp; Groq.
              </p>
            </div>
          </div>

          <Link
            href="/admin/questions"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-mono hover:bg-zinc-800 transition"
          >
            <ListOrdered className="w-4 h-4 text-orange-400" />
            <span>View Question Bank</span>
          </Link>
        </div>

        <AIGenerator onImportQuestions={handleImport} />
      </div>
    </div>
  );
}
