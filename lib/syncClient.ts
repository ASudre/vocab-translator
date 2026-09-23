import { getAllUserProgress, getSyncQueue, mergeServerProgress, removeSyncQueueEntries, UserProgress } from './indexedDB';
import type { AttemptRecord, BaselineProgress } from './sync';

const BASELINE_SENT_KEY = 'vocabDB_baselineSentUserId';

const toBaseline = (progress: UserProgress): BaselineProgress & { vocabularyId: number } => ({
  vocabularyId: progress.vocabularyId,
  successCount: progress.successCount,
  failCount: progress.failCount,
  currentStreak: progress.currentStreak,
  bestStreak: progress.bestStreak,
  attemptHistory: progress.attemptHistory,
  masteryLevel: progress.masteryLevel,
  lastPracticed: progress.lastPracticed,
});

interface SyncResponse {
  progress: (BaselineProgress & { vocabularyId: number })[];
}

/**
 * Pushes any queued attempts (and, once per account on this device, the
 * pre-existing local baseline), then merges the server's authoritative
 * snapshot back into IndexedDB. Safe to call repeatedly/concurrently — a
 * failed push just leaves the outbox for the next call to retry.
 */
export const performSync = async (userId: string): Promise<void> => {
  const queue = await getSyncQueue();
  const attempts: AttemptRecord[] = queue.map(entry => ({
    id: entry.id,
    vocabularyId: entry.vocabularyId,
    level: entry.level,
    isCorrect: entry.isCorrect,
    userAnswer: entry.userAnswer,
    answeredAt: entry.answeredAt,
  }));

  const baselineAlreadySent = localStorage.getItem(BASELINE_SENT_KEY) === userId;
  const baseline = baselineAlreadySent ? [] : (await getAllUserProgress()).map(toBaseline);

  if (attempts.length === 0 && baseline.length === 0 && baselineAlreadySent) return;

  const response = await fetch('/api/sync/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attempts, baseline }),
  });

  if (!response.ok) return; // leave the outbox intact; the next trigger retries

  const data: SyncResponse = await response.json();

  await removeSyncQueueEntries(queue.map(entry => entry.id));
  if (!baselineAlreadySent) localStorage.setItem(BASELINE_SENT_KEY, userId);

  await mergeServerProgress(data.progress.map(row => ({
    vocabularyId: row.vocabularyId,
    successCount: row.successCount,
    failCount: row.failCount,
    currentStreak: row.currentStreak,
    bestStreak: row.bestStreak,
    attemptHistory: row.attemptHistory,
    masteryLevel: row.masteryLevel,
    lastPracticed: row.lastPracticed,
  })));
};
