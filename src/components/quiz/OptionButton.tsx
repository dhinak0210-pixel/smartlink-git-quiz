import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface OptionButtonProps {
  label: 'a' | 'b' | 'c' | 'd';
  text: string;
  isSelected: boolean;
  isCorrect?: boolean | null;
  isDisabled: boolean;
  showResult: boolean;
  onClick: () => void;
}

export function OptionButton({
  label,
  text,
  isSelected,
  isCorrect,
  isDisabled,
  showResult,
  onClick,
}: OptionButtonProps) {
  let containerStyles =
    'border-surface-border bg-surface hover:border-git-orange/50 hover:bg-surface-hover text-text';
  let badgeStyles = 'bg-background border-surface-border text-git-orange';

  if (showResult) {
    if (isCorrect === true) {
      containerStyles = 'border-correct bg-correct/15 text-text';
      badgeStyles = 'bg-correct text-white border-correct';
    } else if (isSelected && isCorrect === false) {
      containerStyles = 'border-wrong bg-wrong/15 text-text';
      badgeStyles = 'bg-wrong text-white border-wrong';
    } else {
      containerStyles = 'border-surface-border bg-surface/50 text-text-muted opacity-60';
      badgeStyles = 'bg-background border-surface-border text-text-muted';
    }
  } else if (isSelected) {
    containerStyles = 'border-git-orange bg-git-orange/15 text-text ring-2 ring-git-orange/30';
    badgeStyles = 'bg-git-orange text-white border-git-orange';
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={`group w-full min-h-[64px] p-4 sm:p-5 rounded-2xl border text-left transition-all duration-150 flex items-center justify-between gap-3.5 shadow-md active:scale-[0.99] disabled:cursor-not-allowed ${containerStyles}`}
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        {/* Label Badge (A, B, C, D) */}
        <span
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center font-mono font-bold text-sm sm:text-base shrink-0 transition-colors uppercase ${badgeStyles}`}
        >
          {label}
        </span>

        {/* Option Text */}
        <span className="font-sans text-sm sm:text-base leading-snug break-words">
          {text}
        </span>
      </div>

      {/* Result indicator icon */}
      {showResult && (
        <div className="shrink-0 ml-2">
          {isCorrect === true && <CheckCircle2 className="w-5 h-5 text-correct" />}
          {isSelected && isCorrect === false && <XCircle className="w-5 h-5 text-wrong" />}
        </div>
      )}
    </button>
  );
}
