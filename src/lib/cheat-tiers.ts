// src/lib/cheat-tiers.ts
/**
 * SmartLink Git Quiz — Client-Side Tier Display & Adjudication Helpers.
 */

export type CheatTier = 'Strong' | 'Review' | 'Watch' | 'Clear';

export type ReviewDecision = 'clear' | 'warning' | 'penalize' | 'disqualify';

export interface StudentTierRecord {
  student_anon: number;
  tier: CheatTier;
  rank_in_tier: number;
  families_fired: string[];
  family_count: number;
  evidence_summary: string;
  trust_score: number;
  is_podium: boolean;
}

export interface ReviewDecisionRecord {
  student_id: number;
  decision: ReviewDecision;
  primary_reviewer: string;
  secondary_reviewer?: string;
  notes: string;
  decided_at: string;
}

export function getTierBadgeStyle(tier: CheatTier): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (tier) {
    case 'Strong':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
        label: 'Strong (Held)',
      };
    case 'Review':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        label: 'Review Required',
      };
    case 'Watch':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        label: 'Watch Status',
      };
    case 'Clear':
    default:
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        label: 'Cleared',
      };
  }
}

export function getTrustScoreColor(score: number): string {
  if (score < 40) return 'text-red-400';
  if (score < 70) return 'text-amber-400';
  return 'text-emerald-400';
}
