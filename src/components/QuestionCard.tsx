'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import TimerBar from './TimerBar';
import OptionButton, { OptionStatus } from './OptionButton';
import ResultOverlay from './ResultOverlay';
import { Clock, Zap } from 'lucide-react';

export interface QuestionData {
  position: number;
  text: string;
  difficulty: string;
  topic: string;
  options: {
    id: string;
    text: string;
    label: string;
  }[];
  time_remaining_ms: number;
}

interface QuestionCardProps {
  question: QuestionData;
  totalScore: number;
  phase: 'answering' | 'result';
  phaseTimeRemainingMs: number;
  onAnswerSubmitted: (points: number) => void;
  onPhaseComplete: () => void;
}

export default function QuestionCard({
  question,
  totalScore,
  phase,
  phaseTimeRemainingMs,
  onAnswerSubmitted,
}: QuestionCardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [resultData, setResultData] = useState<{
    is_correct: boolean;
    points: number;
    correct_option_id: string;
    explanation: string;
    response_ms: number;
  } | null>(null);

  const questionStartTimeRef = useRef<number>(Date.now());
  const hasAutoSubmittedRef = useRef<boolean>(false);

  // Reset local state on new question position
  useEffect(() => {
    setSelectedOptionId(null);
    setSubmitting(false);
    setAnswered(false);
    setResultData(null);
    questionStartTimeRef.current = Date.now();
    hasAutoSubmittedRef.current = false;
  }, [question.position]);

  const submitAnswer = useCallback(
    async (optionId: string | null) => {
      if (answered || submitting) return;
      setSubmitting(true);
      if (optionId) setSelectedOptionId(optionId);

      const localResponseMs = Math.max(0, Date.now() - questionStartTimeRef.current);

      try {
        if (!optionId) {
          // Timeout with no option selected
          setAnswered(true);
          setSubmitting(false);
          setResultData({
            is_correct: false,
            points: 0,
            correct_option_id: '',
            explanation: 'Time expired before an option was selected.',
            response_ms: 20_000,
          });
          onAnswerSubmitted(0);
          return;
        }

        const res = await fetch('/api/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_position: question.position,
            option_id: optionId,
          }),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data) {
          setAnswered(true);
          setSubmitting(false);
          setResultData({
            is_correct: Boolean(data.is_correct),
            points: data.points || 0,
            correct_option_id: data.correct_option_id || '',
            explanation: data.explanation || '',
            response_ms: localResponseMs,
          });
          onAnswerSubmitted(data.points || 0);
        } else if (res.status === 409) {
          // Already answered
          setAnswered(true);
          setSubmitting(false);
        } else {
          // Window expired or other 403
          setAnswered(true);
          setSubmitting(false);
          setResultData({
            is_correct: false,
            points: 0,
            correct_option_id: '',
            explanation: data?.error || 'Submission closed.',
            response_ms: 20_000,
          });
          onAnswerSubmitted(0);
        }
      } catch (err) {
        console.error('[QuestionCard] Answer submission failed:', err);
        setAnswered(true);
        setSubmitting(false);
      }
    },
    [answered, submitting, question.position, onAnswerSubmitted]
  );

  // Auto-submit timeout when in answering phase and time reaches 0
  useEffect(() => {
    if (phase === 'answering' && phaseTimeRemainingMs <= 100 && !answered && !submitting) {
      if (!hasAutoSubmittedRef.current) {
        hasAutoSubmittedRef.current = true;
        submitAnswer(null);
      }
    }
  }, [phase, phaseTimeRemainingMs, answered, submitting, submitAnswer]);

  const secondsDisplay = Math.ceil(phaseTimeRemainingMs / 1000);

  // If in 'result' phase and we have result data, display ResultOverlay
  if (phase === 'result' && resultData) {
    return (
      <ResultOverlay
        isCorrect={resultData.is_correct}
        points={resultData.points}
        responseMs={resultData.response_ms}
        explanation={resultData.explanation}
        secondsRemaining={secondsDisplay}
        isLastQuestion={question.position === 15}
      />
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-5 animate-fadeIn">
      {/* Top Status Bar: Q position, time, total points */}
      <div className="flex items-center justify-between text-xs sm:text-sm font-mono font-bold text-zinc-300 px-1">
        <span className="px-3 py-1 rounded-full bg-zinc-800/90 border border-zinc-700/60">
          Q {question.position} / 15
        </span>

        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800/90 border border-zinc-700/60 text-orange-400">
          <Clock className="w-3.5 h-3.5" />
          {secondsDisplay}s
        </span>

        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
          <Zap className="w-3.5 h-3.5" />
          {totalScore.toLocaleString()} pts
        </span>
      </div>

      {/* Shrinking Timer Bar */}
      <TimerBar
        timeRemainingMs={phaseTimeRemainingMs}
        totalDurationMs={phase === 'answering' ? 20_000 : 5_000}
      />

      {/* Question Main Card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-md space-y-6">
        {/* Difficulty and Topic Tag */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            {question.difficulty}
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            #{question.topic}
          </span>
        </div>

        {/* Question Text */}
        <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
          {question.text}
        </h2>

        {/* 4 Shuffled Options */}
        <div className="space-y-3 pt-2">
          {question.options.map((opt) => {
            let status: OptionStatus = 'idle';

            if (submitting && selectedOptionId === opt.id) {
              status = 'loading';
            } else if (resultData) {
              if (opt.id === resultData.correct_option_id) {
                status = 'correct';
              } else if (opt.id === selectedOptionId && !resultData.is_correct) {
                status = 'incorrect';
              } else {
                status = 'dimmed';
              }
            } else if (answered && selectedOptionId !== opt.id) {
              status = 'dimmed';
            }

            const isLocked = answered || submitting || phase === 'result';

            return (
              <OptionButton
                key={opt.id}
                id={opt.id}
                label={opt.label}
                text={opt.text}
                status={status}
                disabled={isLocked}
                onClick={() => submitAnswer(opt.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
