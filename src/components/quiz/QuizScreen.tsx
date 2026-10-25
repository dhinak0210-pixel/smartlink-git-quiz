'use client';

import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Award, CheckCircle2, XCircle, Info, Sparkles, AlertCircle } from 'lucide-react';
import { EventStatusResponse, SafeQuestion, SubmitAnswerResult } from '@/lib/utils/types';
import { useTimer } from '@/hooks/useTimer';
import { useClockSync } from '@/hooks/useClockSync';
import { useAntiCheat } from '@/hooks/useAntiCheat';
import { playSound } from '@/lib/utils/helpers';
import { QuestionCard } from './QuestionCard';
import { OptionButton } from './OptionButton';
import { Timer } from './Timer';
import { ProgressBar } from './ProgressBar';

interface QuizScreenProps {
  eventState: EventStatusResponse;
  onQuizFinished: () => void;
}

export function QuizScreen({ eventState, onQuizFinished }: QuizScreenProps) {
  const { offsetMs } = useClockSync();
  const [question, setQuestion] = useState<SafeQuestion | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState<boolean>(true);
  const [questionError, setQuestionError] = useState<string | null>(null);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<SubmitAnswerResult | null>(null);
  const [hasTimedOutSent, setHasTimedOutSent] = useState<boolean>(false);

  // Activate Anti-Cheat Client Listeners
  useAntiCheat(eventState.current_question_number);

  // Countdown timer based on server-time anchor
  const timer = useTimer(
    eventState.question_started_at,
    eventState.time_per_question_seconds,
    offsetMs,
    !submissionResult // mute ticks if already answered
  );

  // Fetch question details whenever current_question_number changes
  const fetchCurrentQuestion = useCallback(async () => {
    if (eventState.current_question_number <= 0) return;

    setLoadingQuestion(true);
    setQuestionError(null);
    setSelectedOption(null);
    setSubmissionResult(null);
    setHasTimedOutSent(false);

    try {
      const res = await fetch('/api/question/current', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch question');
      }

      setQuestion(data);

      // If already answered on previous connection/refresh
      if (data.already_answered) {
        setSelectedOption(data.your_answer);
        setSubmissionResult({
          is_correct: data.your_is_correct,
          correct_answer: data.revealed_correct_answer || '',
          explanation: data.revealed_explanation || '',
          score_awarded: data.your_score || 0,
          time_taken_ms: 0,
        });
      }
    } catch (err: any) {
      setQuestionError(err.message || 'Error loading question');
    } finally {
      setLoadingQuestion(false);
    }
  }, [eventState.current_question_number]);

  useEffect(() => {
    fetchCurrentQuestion();
  }, [fetchCurrentQuestion]);

  // Handle Answer Submission
  const handleSubmitAnswer = async (optionLabel: string) => {
    if (submitting || submissionResult || timer.isExpired || !question) return;

    setSelectedOption(optionLabel);
    setSubmitting(true);

    try {
      const res = await fetch('/api/question/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_number: question.question_number,
          selected_answer: optionLabel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Submission error');
      }

      setSubmissionResult(data);

      if (data.is_correct) {
        playSound('correct');
        // Confetti burst on correct answer
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#F97316', '#3FB950', '#ffffff', '#FB923C'],
          });
        } catch {
          // Ignore confetti error on headless/unsupported
        }
      } else {
        playSound('wrong');
      }
    } catch (err: any) {
      console.error('Answer submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit timeout when timer reaches 0
  useEffect(() => {
    if (
      timer.isExpired &&
      !submissionResult &&
      !hasTimedOutSent &&
      question &&
      !loadingQuestion
    ) {
      setHasTimedOutSent(true);
      handleSubmitAnswer(''); // Submit blank on timeout
    }
  }, [timer.isExpired, submissionResult, hasTimedOutSent, question, loadingQuestion]);

  if (loadingQuestion) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-2 border-git-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-text-muted font-mono text-xs">
          Loading Question #{eventState.current_question_number}...
        </p>
      </div>
    );
  }

  if (questionError || !question) {
    return (
      <div className="rounded-2xl border border-wrong/30 bg-wrong/10 p-6 text-center max-w-lg mx-auto">
        <AlertCircle className="w-8 h-8 text-wrong mx-auto mb-2" />
        <h3 className="font-mono text-base font-bold text-text">Question Load Error</h3>
        <p className="text-xs text-text-muted mt-1">{questionError || 'Unable to sync question state'}</p>
        <button
          onClick={fetchCurrentQuestion}
          className="mt-4 px-4 py-2 rounded-lg bg-surface border border-surface-border text-text hover:bg-surface-hover text-xs font-mono"
        >
          Retry Question
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      {/* Top Header: Progress & Timer */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-surface/80 p-4 rounded-2xl border border-surface-border backdrop-blur-md shadow-lg">
        <div className="flex-1">
          <ProgressBar
            current={question.question_number}
            total={eventState.total_questions}
          />
        </div>
        <div className="flex items-center justify-end">
          <Timer timer={timer} />
        </div>
      </div>

      {/* Question Card */}
      <QuestionCard
        questionNumber={question.question_number}
        questionText={question.question_text}
        topicTag={question.topic_tag}
        difficulty={question.difficulty}
        points={question.points}
      />

      {/* Answer Options Grid */}
      <div className="grid grid-cols-1 gap-3 sm:gap-3.5">
        {question.options.map((opt) => {
          const isSelected = selectedOption === opt.label;
          const isCorrect =
            submissionResult !== null
              ? opt.label === submissionResult.correct_answer ||
                opt.originalLabel === submissionResult.correct_answer
              : null;

          return (
            <OptionButton
              key={opt.label}
              label={opt.label}
              text={opt.text}
              isSelected={isSelected}
              isCorrect={isCorrect}
              isDisabled={submitting || submissionResult !== null || timer.isExpired}
              showResult={submissionResult !== null || timer.isExpired}
              onClick={() => handleSubmitAnswer(opt.label)}
            />
          );
        })}
      </div>

      {/* Post-Answer Feedback Banner */}
      {submissionResult && (
        <div
          className={`rounded-2xl border p-5 sm:p-6 backdrop-blur-md shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-3 ${
            submissionResult.is_correct
              ? 'border-correct/40 bg-correct/10 text-text'
              : 'border-wrong/40 bg-wrong/10 text-text'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 font-mono font-bold text-base sm:text-lg">
              {submissionResult.is_correct ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-correct" />
                  <span className="text-correct">Correct Answer!</span>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-wrong" />
                  <span className="text-wrong">
                    {timer.isExpired && !selectedOption ? 'Time Expired!' : 'Incorrect Answer'}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 font-mono text-sm">
              <span
                className={`px-3 py-1 rounded-full bg-background border border-surface-border font-bold flex items-center gap-1.5 ${
                  submissionResult.score_awarded > 0
                    ? 'text-correct'
                    : submissionResult.score_awarded < 0
                    ? 'text-wrong'
                    : 'text-text-muted'
                }`}
              >
                <Award className="w-4 h-4" />
                {submissionResult.score_awarded > 0
                  ? `+${submissionResult.score_awarded}`
                  : submissionResult.score_awarded}{' '}
                Points
              </span>
            </div>
          </div>

          {/* Explanation */}
          {submissionResult.explanation && (
            <div className="mt-3 p-3.5 rounded-xl bg-background/80 border border-surface-border text-xs sm:text-sm font-sans leading-relaxed text-text">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted mb-1 uppercase tracking-wide">
                <Info className="w-3.5 h-3.5 text-git-orange" />
                <span>Concept Explanation</span>
              </div>
              <p>{submissionResult.explanation}</p>
            </div>
          )}

          <div className="mt-3 text-center text-xs font-mono text-text-muted">
            Waiting for next question from the quiz master...
          </div>
        </div>
      )}
    </div>
  );
}
