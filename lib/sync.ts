import { computeNextProgress } from './progress';
import type { UserProgress } from './indexedDB';

/** An attempt as sent over the wire (client-generated id for idempotency). */
export interface AttemptRecord {
  id: string;
  vocabularyId: number;
  level: string;
  isCorrect: boolean;
  userAnswer?: string | null;
  answeredAt: string; // ISO 8601, client clock
}

/** A locally-computed aggregate uploaded as a seed for pre-existing progress that has no attempt log. */
export type BaselineProgress = Omit<UserProgress, 'id'>;

/**
 * Deterministic order for replay: primarily by client clock, with the
 * client-generated id as a tiebreaker for equal timestamps. Using the id
 * (not insertion order) keeps this pure and independent of how the caller
 * batched the attempts.
 */
const sortAttempts = (attempts: AttemptRecord[]): AttemptRecord[] =>
  [...attempts].sort((a, b) => {
    if (a.answeredAt !== b.answeredAt) return a.answeredAt < b.answeredAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

/**
 * Recomputes a word's aggregate from scratch: baseline, then every attempt
 * replayed in order through the same computeNextProgress used on the
 * client. currentStreak/bestStreak/attemptHistory are order-dependent, so
 * this — rather than incrementally applying just the newest attempt — is
 * what makes clock skew between devices and out-of-order arrivals harmless:
 * there is nothing to reconcile, only a deterministic replay of a set union.
 *
 * Returns undefined only when there is neither a baseline nor any attempts
 * for this word (nothing to store).
 */
export const replayProgress = (
  baseline: BaselineProgress | undefined,
  attempts: AttemptRecord[]
): UserProgress | undefined => {
  if (attempts.length === 0) return baseline as UserProgress | undefined;

  return sortAttempts(attempts).reduce<UserProgress | undefined>((acc, attempt) => ({
    ...computeNextProgress(acc, attempt.isCorrect, attempt.answeredAt),
    vocabularyId: attempt.vocabularyId,
  }), baseline as UserProgress | undefined);
};

const attemptCount = (progress: BaselineProgress): number => progress.successCount + progress.failCount;

/**
 * Two devices can each hold months of local progress for the same word with
 * no way to merge them (no attempt log backs either one). Keep whichever
 * reflects more practice. On a tie, `incoming` wins — callers always pass
 * (existing stored baseline, incoming upload) in that order, so re-sending
 * the same baseline is a stable no-op rather than an oscillation.
 */
export const pickBaseline = (existing: BaselineProgress, incoming: BaselineProgress): BaselineProgress =>
  attemptCount(incoming) >= attemptCount(existing) ? incoming : existing;
