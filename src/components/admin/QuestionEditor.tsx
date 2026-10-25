'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Question } from '@/lib/utils/types';
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  Check,
  AlertCircle,
  FileText,
  FileUp,
  X,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Search,
  BookOpen,
  Clock,
  Layers,
  Flame,
  CheckCircle,
  HelpCircle,
  Filter,
} from 'lucide-react';

interface QuestionEditorProps {
  questions: Question[];
  onRefresh: () => void;
}

export function QuestionEditor({ questions, onRefresh }: QuestionEditorProps) {
  // Search & Filter State
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');

  // Single Question Create / Edit Modal State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Question>>({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'a',
    explanation: '',
    topic_tag: 'git-basics',
    difficulty: 'medium',
    time_limit_seconds: 20,
    points: 100,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // PDF & Bulk Question Import Modal State
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfTab, setPdfTab] = useState<'file' | 'paste'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);
  const [pdfText, setPdfText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<Partial<Question>[]>([]);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null);

  // Compute Distinct Topics
  const allTopics = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.topic_tag) set.add(q.topic_tag.toLowerCase().trim());
    });
    return Array.from(set).sort();
  }, [questions]);

  // Compute Counts
  const easyCount = useMemo(() => questions.filter((q) => q.difficulty === 'easy').length, [questions]);
  const medCount = useMemo(() => questions.filter((q) => q.difficulty === 'medium').length, [questions]);
  const hardCount = useMemo(() => questions.filter((q) => q.difficulty === 'hard').length, [questions]);

  // Filtered Questions List
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const qText = (q.question_text || '').toLowerCase();
      const qTopic = (q.topic_tag || '').toLowerCase();
      const qOptA = (q.option_a || '').toLowerCase();
      const qOptB = (q.option_b || '').toLowerCase();
      const qOptC = (q.option_c || '').toLowerCase();
      const qOptD = (q.option_d || '').toLowerCase();
      const qExpl = (q.explanation || '').toLowerCase();

      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        qText.includes(term) ||
        qTopic.includes(term) ||
        qOptA.includes(term) ||
        qOptB.includes(term) ||
        qOptC.includes(term) ||
        qOptD.includes(term) ||
        qExpl.includes(term) ||
        String(q.question_number) === term;

      const matchesDifficulty = difficultyFilter === 'all' || q.difficulty === difficultyFilter;
      const matchesTopic = selectedTopic === 'all' || qTopic === selectedTopic.toLowerCase();

      return matchesSearch && matchesDifficulty && matchesTopic;
    });
  }, [questions, search, difficultyFilter, selectedTopic]);

  const startNew = () => {
    setEditingId('new');
    setFormData({
      question_number: questions.length + 1,
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'a',
      explanation: '',
      topic_tag: 'git-basics',
      difficulty: 'medium',
      time_limit_seconds: 20,
      points: 100,
    });
    setFormError(null);
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setFormData({ ...q });
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);

    try {
      const res = await fetch('/api/question/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save question');
      }

      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Error saving question');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`/api/question/admin?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete question');
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Upload PDF file
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsProcessingPdf(true);
    setPdfError(null);
    setPdfSuccess(null);

    try {
      const data = new FormData();
      data.append('file', file);

      const res = await fetch('/api/admin/questions/import-pdf', {
        method: 'POST',
        body: data,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to parse PDF');

      setParsedQuestions(json.questions || []);
      if (!json.questions || json.questions.length === 0) {
        setPdfError('No multiple-choice questions detected in this file. Try pasting question text directly.');
      } else {
        setPdfSuccess(`Detected ${json.questions.length} questions from ${file.name}! Review below before importing.`);
      }
    } catch (err: any) {
      setPdfError(err.message || 'Error processing PDF');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Parse raw pasted text from PDF
  const handleParsePastedText = async () => {
    if (!pdfText.trim()) {
      setPdfError('Please paste text from your question paper.');
      return;
    }
    setIsProcessingPdf(true);
    setPdfError(null);
    setPdfSuccess(null);

    try {
      const res = await fetch('/api/admin/questions/import-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pdfText }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to parse text');

      setParsedQuestions(json.questions || []);
      if (!json.questions || json.questions.length === 0) {
        setPdfError('No questions detected. Ensure each question has a number (1. / Q1:) and options A–D.');
      } else {
        setPdfSuccess(`Successfully extracted ${json.questions.length} questions! Review below.`);
      }
    } catch (err: any) {
      setPdfError(err.message);
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Commit and save all parsed questions
  const handleSaveAllQuestions = async () => {
    if (parsedQuestions.length === 0) return;
    setIsSavingQuestions(true);
    setPdfError(null);

    try {
      const res = await fetch('/api/admin/questions/import-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save: true, questions: parsedQuestions }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save questions');

      setShowPdfModal(false);
      setParsedQuestions([]);
      setSelectedFile(null);
      setPdfText('');
      onRefresh();
    } catch (err: any) {
      setPdfError(err.message || 'Import failed');
    } finally {
      setIsSavingQuestions(false);
    }
  };

  const handleRemoveParsedItem = (index: number) => {
    setParsedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* ================= 1. UNIFIED COMMAND HEADER ================= */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-orange-400" />
              <span>Question Bank &amp; Curriculum Management</span>
            </h1>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Curate, edit, and bulk-import official Git technical tournament questions.
            </p>
          </div>
        </div>

        {/* Action Buttons Cluster */}
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
          <button
            onClick={() => {
              setShowPdfModal(true);
              setPdfError(null);
              setPdfSuccess(null);
            }}
            className="h-9 px-3.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold flex items-center gap-2 transition shadow-sm"
          >
            <FileText className="w-4 h-4 text-orange-400" />
            <span>Import from PDF</span>
          </button>

          <Link
            href="/admin/questions/generate"
            className="h-9 px-3.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold flex items-center gap-2 transition shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Synthesize AI</span>
          </Link>

          <button
            onClick={startNew}
            className="h-9 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center gap-2 transition shadow-md shadow-orange-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question</span>
          </button>

          <button
            onClick={onRefresh}
            className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition shrink-0"
            title="Refresh Question List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= 2. METRICS CARDS STRIP ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 font-mono">
        {/* Total Questions */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">TOTAL IN VAULT</div>
            <div className="text-2xl font-bold text-white mt-0.5">{questions.length}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">15 active in live arena</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
            <Layers className="w-5 h-5 text-orange-400" />
          </div>
        </div>

        {/* Easy Pool */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] text-emerald-400/80 uppercase tracking-wider">EASY POOL (Q1-5)</div>
            <div className="text-2xl font-bold text-emerald-400 mt-0.5">{easyCount}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">5 needed per participant</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Medium Pool */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] text-amber-400/80 uppercase tracking-wider">MEDIUM POOL (Q6-10)</div>
            <div className="text-2xl font-bold text-amber-400 mt-0.5">{medCount}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">5 needed per participant</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* Hard Pool */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] text-rose-400/80 uppercase tracking-wider">HARD POOL (Q11-15)</div>
            <div className="text-2xl font-bold text-rose-400 mt-0.5">{hardCount}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">5 needed per participant</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Flame className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ================= 3. FILTER & SEARCH COMMAND BAR ================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/80">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions by text, option, explanation, or #number..."
            className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-9 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white rounded-md transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Difficulty Filter Pills */}
        <div className="flex items-center gap-1.5 font-mono text-xs overflow-x-auto pb-1 md:pb-0 shrink-0">
          <button
            onClick={() => setDifficultyFilter('all')}
            className={`h-9 px-3.5 rounded-xl border flex items-center transition ${
              difficultyFilter === 'all'
                ? 'bg-zinc-800 text-white border-zinc-700 font-bold'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            All ({questions.length})
          </button>
          <button
            onClick={() => setDifficultyFilter('easy')}
            className={`h-9 px-3.5 rounded-xl border flex items-center transition ${
              difficultyFilter === 'easy'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-emerald-400'
            }`}
          >
            Easy ({easyCount})
          </button>
          <button
            onClick={() => setDifficultyFilter('medium')}
            className={`h-9 px-3.5 rounded-xl border flex items-center transition ${
              difficultyFilter === 'medium'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-amber-400'
            }`}
          >
            Medium ({medCount})
          </button>
          <button
            onClick={() => setDifficultyFilter('hard')}
            className={`h-9 px-3.5 rounded-xl border flex items-center transition ${
              difficultyFilter === 'hard'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-rose-400'
            }`}
          >
            Hard ({hardCount})
          </button>
        </div>

        {/* Topic Tag Selector Dropdown */}
        {allTopics.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-orange-500"
            >
              <option value="all">All Topics ({allTopics.length})</option>
              {allTopics.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Filter Status Message */}
      {(search || difficultyFilter !== 'all' || selectedTopic !== 'all') && (
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-1">
          <span>
            Showing <strong className="text-white">{filteredQuestions.length}</strong> of {questions.length} questions
          </span>
          <button
            onClick={() => {
              setSearch('');
              setDifficultyFilter('all');
              setSelectedTopic('all');
            }}
            className="text-orange-400 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* ================= 4. STRUCTURED QUESTION CARDS LIST ================= */}
      {filteredQuestions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
          <HelpCircle className="w-10 h-10 mx-auto text-zinc-600" />
          <h3 className="text-base font-bold text-white">No questions match your criteria</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Try adjusting your search query, difficulty filter, or topic selection.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setDifficultyFilter('all');
              setSelectedTopic('all');
            }}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300 transition"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQuestions.map((q, idx) => {
            const diffColor =
              q.difficulty === 'easy'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : q.difficulty === 'hard'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30';

            const isA = q.correct_answer?.toLowerCase() === 'a';
            const isB = q.correct_answer?.toLowerCase() === 'b';
            const isC = q.correct_answer?.toLowerCase() === 'c';
            const isD = q.correct_answer?.toLowerCase() === 'd';

            return (
              <div
                key={q.id || idx}
                className="rounded-2xl border border-zinc-800/90 bg-zinc-950 p-5 space-y-4 hover:border-zinc-700 transition shadow-sm"
              >
                {/* Header row: Number, Badges & Action Buttons */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="font-bold text-orange-400 text-sm px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      #{q.question_number || idx + 1}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wider ${diffColor}`}>
                      {q.difficulty}
                    </span>

                    <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px]">
                      #{q.topic_tag || 'git'}
                    </span>

                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400 text-[11px]">{q.points || 100} pts</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {q.time_limit_seconds || 20}s
                    </span>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(q)}
                      className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition"
                      title="Edit Question"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center transition"
                      title="Delete Question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <p className="text-white text-base font-medium leading-relaxed break-words font-sans">
                  {q.question_text}
                </p>

                {/* 4 Multiple Choice Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs font-mono">
                  {/* Option A */}
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      isA
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 font-semibold shadow-sm'
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold ${
                      isA ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      A
                    </span>
                    <span className="flex-1 break-words leading-tight">{q.option_a || '—'}</span>
                    {isA && (
                      <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 shrink-0">
                        CORRECT
                      </span>
                    )}
                  </div>

                  {/* Option B */}
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      isB
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 font-semibold shadow-sm'
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold ${
                      isB ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      B
                    </span>
                    <span className="flex-1 break-words leading-tight">{q.option_b || '—'}</span>
                    {isB && (
                      <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 shrink-0">
                        CORRECT
                      </span>
                    )}
                  </div>

                  {/* Option C */}
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      isC
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 font-semibold shadow-sm'
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold ${
                      isC ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      C
                    </span>
                    <span className="flex-1 break-words leading-tight">{q.option_c || '—'}</span>
                    {isC && (
                      <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 shrink-0">
                        CORRECT
                      </span>
                    )}
                  </div>

                  {/* Option D */}
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      isD
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 font-semibold shadow-sm'
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold ${
                      isD ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      D
                    </span>
                    <span className="flex-1 break-words leading-tight">{q.option_d || '—'}</span>
                    {isD && (
                      <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 shrink-0">
                        CORRECT
                      </span>
                    )}
                  </div>
                </div>

                {/* Explanation Block */}
                {q.explanation && (
                  <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-xs text-zinc-400 leading-relaxed font-mono flex items-start gap-2">
                    <span className="text-orange-400 shrink-0 mt-0.5">💡</span>
                    <div>
                      <strong className="text-zinc-300">Explanation:</strong> {q.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ================= 5. ADD / EDIT QUESTION MODAL OVERLAY ================= */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-orange-400" />
                <span>{editingId === 'new' ? 'Create New Question' : `Edit Question #${formData.question_number}`}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Question Prompt Text *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.question_text || ''}
                  onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition"
                  placeholder="e.g. Which command allows staging only parts of a modified file?"
                />
              </div>

              {/* 4 Options Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Option A *</label>
                  <input
                    required
                    type="text"
                    value={formData.option_a || ''}
                    onChange={(e) => setFormData({ ...formData, option_a: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                    placeholder="First choice"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Option B *</label>
                  <input
                    required
                    type="text"
                    value={formData.option_b || ''}
                    onChange={(e) => setFormData({ ...formData, option_b: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                    placeholder="Second choice"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Option C *</label>
                  <input
                    required
                    type="text"
                    value={formData.option_c || ''}
                    onChange={(e) => setFormData({ ...formData, option_c: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                    placeholder="Third choice"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Option D *</label>
                  <input
                    required
                    type="text"
                    value={formData.option_d || ''}
                    onChange={(e) => setFormData({ ...formData, option_d: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                    placeholder="Fourth choice"
                  />
                </div>
              </div>

              {/* Correct Answer & Difficulty Controls */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Correct Answer *</label>
                  <select
                    value={formData.correct_answer || 'a'}
                    onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value as any })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500 uppercase font-bold"
                  >
                    <option value="a">A</option>
                    <option value="b">B</option>
                    <option value="c">C</option>
                    <option value="d">D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Difficulty *</label>
                  <select
                    value={formData.difficulty || 'medium'}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="easy">Easy (Q1-5)</option>
                    <option value="medium">Medium (Q6-10)</option>
                    <option value="hard">Hard (Q11-15)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Points</label>
                  <input
                    type="number"
                    value={formData.points || 100}
                    onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Time Limit</label>
                  <input
                    type="number"
                    value={formData.time_limit_seconds || 20}
                    onChange={(e) => setFormData({ ...formData, time_limit_seconds: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Topic Tag</label>
                <input
                  type="text"
                  value={formData.topic_tag || 'git-basics'}
                  onChange={(e) => setFormData({ ...formData, topic_tag: e.target.value })}
                  placeholder="e.g. rebase, branching, commit, merge"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Explanation</label>
                <textarea
                  rows={2}
                  value={formData.explanation || ''}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                  placeholder="Explanation displayed on the review screen..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-mono text-xs font-bold transition shadow-md shadow-orange-950/40 disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSaving ? 'Saving...' : 'Save Question'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 6. PDF QUESTION IMPORT MODAL OVERLAY ================= */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl bg-zinc-950 border border-orange-500/30 rounded-2xl p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-mono text-base font-bold text-white flex items-center gap-2">
                    <span>Import Questions from PDF Document</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      PDF / DOC / TXT
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Upload your question paper or paste text. Automatically detects options, answer keys, and difficulty.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPdfModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
              <button
                type="button"
                onClick={() => setPdfTab('file')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition ${
                  pdfTab === 'file'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Upload PDF Document</span>
              </button>
              <button
                type="button"
                onClick={() => setPdfTab('paste')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition ${
                  pdfTab === 'paste'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Paste Question Text</span>
              </button>
            </div>

            {pdfError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{pdfError}</span>
              </div>
            )}

            {pdfSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{pdfSuccess}</span>
              </div>
            )}

            {/* TAB 1: File Upload */}
            {pdfTab === 'file' && (
              <div className="space-y-4">
                <label className="relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-800 hover:border-orange-500/60 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/80 cursor-pointer transition group text-center">
                  <input
                    type="file"
                    accept=".pdf,.txt,.json"
                    onChange={handlePdfUpload}
                    disabled={isProcessingPdf}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-3 group-hover:scale-110 transition-transform">
                    {isProcessingPdf ? (
                      <RefreshCw className="w-6 h-6 animate-spin text-orange-400" />
                    ) : (
                      <FileUp className="w-6 h-6 text-orange-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {selectedFile ? selectedFile.name : 'Click to select or drag & drop Question PDF'}
                    </p>
                    <p className="text-xs text-zinc-400 font-mono">
                      Accepts <span className="text-orange-400">.pdf</span>, <span className="text-orange-400">.txt</span>, or <span className="text-orange-400">.json</span> files
                    </p>
                  </div>
                  {isProcessingPdf && (
                    <p className="mt-3 text-xs text-orange-400 font-mono animate-pulse">
                      Analyzing PDF and extracting question structures...
                    </p>
                  )}
                </label>

                <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                  <div className="font-semibold text-zinc-300 font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                    Supported Question Formats:
                  </div>
                  <p>• Standard: <code className="text-orange-300 font-mono">1. Question? A) ... B) ... C) ... D) ... Ans: B</code></p>
                  <p>• Prefix: <code className="text-orange-300 font-mono">Q1: Question? (a) ... (b) ... Correct Answer: b</code></p>
                </div>
              </div>
            )}

            {/* TAB 2: Paste Raw Text */}
            {pdfTab === 'paste' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400 font-mono">
                  Paste question paper text below. The parser will detect questions, options A–D, answer keys, and explanations:
                </p>
                <textarea
                  rows={8}
                  value={pdfText}
                  onChange={(e) => setPdfText(e.target.value)}
                  placeholder={`1. What command is used to stage changes in Git?\nA) git commit\nB) git add\nC) git push\nD) git status\nAnswer: B\nExplanation: git add stages modifications.`}
                  className="w-full font-mono text-xs bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  disabled={isProcessingPdf || !pdfText.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-mono text-xs font-bold transition disabled:opacity-50"
                >
                  {isProcessingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Parse Questions from Text</span>
                </button>
              </div>
            )}

            {/* PARSED PREVIEW SECTION */}
            {parsedQuestions.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="font-bold text-white">Parsed: {parsedQuestions.length} Questions</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                      {parsedQuestions.filter((q) => q.difficulty === 'easy').length} Easy
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                      {parsedQuestions.filter((q) => q.difficulty === 'medium').length} Med
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold">
                      {parsedQuestions.filter((q) => q.difficulty === 'hard').length} Hard
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAllQuestions}
                    disabled={isSavingQuestions}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-mono text-xs font-bold shadow-lg shadow-orange-950/40 transition disabled:opacity-50"
                  >
                    {isSavingQuestions ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Import All {parsedQuestions.length} Questions</span>
                  </button>
                </div>

                {/* Scrollable question card previews */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {parsedQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2 text-xs hover:border-zinc-700 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="font-bold text-orange-400">#{idx + 1}</span>
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase">
                            {q.topic_tag || 'git'}
                          </span>
                          <span className="capitalize text-zinc-400">{q.difficulty}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveParsedItem(idx)}
                          className="text-zinc-500 hover:text-rose-400 p-1"
                          title="Remove question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="font-medium text-white">{q.question_text}</p>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className={`p-1.5 rounded border ${q.correct_answer?.toLowerCase() === 'a' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}>
                          A) {q.option_a || '—'}
                        </div>
                        <div className={`p-1.5 rounded border ${q.correct_answer?.toLowerCase() === 'b' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}>
                          B) {q.option_b || '—'}
                        </div>
                        <div className={`p-1.5 rounded border ${q.correct_answer?.toLowerCase() === 'c' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}>
                          C) {q.option_c || '—'}
                        </div>
                        <div className={`p-1.5 rounded border ${q.correct_answer?.toLowerCase() === 'd' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}>
                          D) {q.option_d || '—'}
                        </div>
                      </div>

                      {q.explanation && (
                        <p className="text-[10px] text-zinc-400 italic font-mono">
                          💡 Answer: <span className="text-emerald-400 font-bold uppercase">{q.correct_answer}</span> — {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
