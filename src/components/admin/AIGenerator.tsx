'use client';

import React, { useState } from 'react';
import { Sparkles, Check, AlertCircle, RefreshCw, Plus, ArrowRight, ShieldCheck } from 'lucide-react';
import { Question } from '@/lib/utils/types';

interface AIGeneratorProps {
  onImportQuestions: (questions: Partial<Question>[]) => void;
}

export function AIGenerator({ onImportQuestions }: AIGeneratorProps) {
  const [topic, setTopic] = useState('branching and merging');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [generatedList, setGeneratedList] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importedSuccess, setImportedSuccess] = useState(false);

  const topicsList = [
    'branching and merging',
    'rebasing and interactive rebase',
    'git reset vs revert',
    'cherry-pick and patch workflows',
    'git stashing and worktree',
    'git internals (blobs, trees, commits, tags)',
    'merge conflict resolution',
    'git reflog and recovery',
    'remote tracking branches and fetch/pull',
    'git hooks and automation',
  ];

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setImportedSuccess(false);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty, count }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setGeneratedList(data.questions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptAll = () => {
    onImportQuestions(generatedList);
    setImportedSuccess(true);
  };

  return (
    <div className="space-y-6">
      {/* Parameter Selection Card */}
      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950 p-6 space-y-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-mono">AI Git Question Generator</h2>
            <p className="text-xs text-zinc-400">
              Pre-event question synthesizer powered by Gemini (with Groq backup)
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1.5">GIT TOPIC</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
            >
              {topicsList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1.5">DIFFICULTY</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 capitalize"
            >
              <option value="easy">Easy (Fundamentals)</option>
              <option value="medium">Medium (Workflows)</option>
              <option value="hard">Hard (Internals & Recovery)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1.5">QUESTION COUNT</label>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGenerate}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generating with AI & Validating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Synthesize & Validate Questions</span>
            </>
          )}
        </button>
      </div>

      {/* Generated Questions Review */}
      {generatedList.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold text-white">
              Generated Candidates ({generatedList.length})
            </h3>
            <button
              onClick={handleAcceptAll}
              disabled={importedSuccess}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{importedSuccess ? 'Imported to Bank!' : 'Accept All into Question Bank'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {generatedList.map((q, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-zinc-800/90 bg-zinc-950 p-5 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="font-bold text-orange-400">Candidate #{idx + 1}</span>
                    <span className="text-zinc-400 capitalize">({q.difficulty})</span>
                  </div>
                  {q.is_valid && (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>AI Validated</span>
                    </span>
                  )}
                </div>

                <p className="font-sans text-sm text-white font-medium">{q.question_text}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className={`p-2.5 rounded-xl border ${q.correct_answer?.toLowerCase() === 'a' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>
                    <strong className="text-orange-400 mr-1.5">A:</strong> {q.option_a}
                  </div>
                  <div className={`p-2.5 rounded-xl border ${q.correct_answer?.toLowerCase() === 'b' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>
                    <strong className="text-orange-400 mr-1.5">B:</strong> {q.option_b}
                  </div>
                  <div className={`p-2.5 rounded-xl border ${q.correct_answer?.toLowerCase() === 'c' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>
                    <strong className="text-orange-400 mr-1.5">C:</strong> {q.option_c}
                  </div>
                  <div className={`p-2.5 rounded-xl border ${q.correct_answer?.toLowerCase() === 'd' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>
                    <strong className="text-orange-400 mr-1.5">D:</strong> {q.option_d}
                  </div>
                </div>

                <div className="text-xs font-mono text-zinc-400 pt-1">
                  <span>Marked Answer: <strong className="text-emerald-400 uppercase font-bold">{q.correct_answer}</strong></span>
                  {q.explanation && (
                    <p className="font-sans text-xs text-zinc-400 mt-1">💡 {q.explanation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
