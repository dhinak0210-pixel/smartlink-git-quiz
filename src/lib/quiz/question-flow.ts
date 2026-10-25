import { EventStatus } from '@/lib/utils/types';

export type QuizPhase =
  | 'idle'
  | 'lobby'
  | 'countdown'
  | 'active_question'
  | 'question_feedback'
  | 'paused'
  | 'finished';

export function determineQuizPhase(
  eventStatus: EventStatus,
  currentQuestionNumber: number,
  alreadyAnswered: boolean,
  isExpired: boolean
): QuizPhase {
  if (eventStatus === 'draft' || eventStatus === 'lobby') {
    return 'lobby';
  }
  if (eventStatus === 'paused') {
    return 'paused';
  }
  if (eventStatus === 'finished') {
    return 'finished';
  }
  if (eventStatus === 'live') {
    if (currentQuestionNumber === 0) {
      return 'lobby';
    }
    if (alreadyAnswered || isExpired) {
      return 'question_feedback';
    }
    return 'active_question';
  }
  return 'idle';
}
