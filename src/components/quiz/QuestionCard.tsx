import React from 'react';
import { Terminal, Award, Tag } from 'lucide-react';
import { Difficulty } from '@/lib/utils/types';

interface QuestionCardProps {
  questionNumber: number;
  questionText: string;
  topicTag: string;
  difficulty: Difficulty;
  points: number;
}

export function QuestionCard({
  questionNumber,
  questionText,
  topicTag,
  difficulty,
  points,
}: QuestionCardProps) {
  const difficultyColors = {
    easy: 'text-correct bg-correct/10 border-correct/30',
    medium: 'text-warning bg-warning/10 border-warning/30',
    hard: 'text-wrong bg-wrong/10 border-wrong/30',
  };

  // Format question text: Highlight text inside backticks `like this` as code blocks
  const parts = questionText.split(/(`[^`]+`)/g);

  return (
    <div className="w-full rounded-2xl border border-surface-border bg-surface/90 p-5 sm:p-7 shadow-xl relative overflow-hidden">
      {/* Top badges */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-background border border-surface-border text-git-orange font-semibold">
            <Tag className="w-3.5 h-3.5" />
            <span>#{topicTag}</span>
          </span>
          <span
            className={`px-2.5 py-1 rounded-md border font-medium capitalize ${
              difficultyColors[difficulty] || difficultyColors.medium
            }`}
          >
            {difficulty}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-background border border-surface-border text-text font-bold">
          <Award className="w-3.5 h-3.5 text-git-orange" />
          <span>{points} pts</span>
        </div>
      </div>

      {/* Question Prompt */}
      <div className="text-base sm:text-lg lg:text-xl font-medium text-text leading-relaxed">
        {parts.map((part, idx) => {
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={idx}
                className="mx-1 px-2 py-0.5 rounded-md bg-background border border-surface-border text-git-orange font-mono text-sm sm:text-base font-semibold shadow-inner"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </div>
    </div>
  );
}
