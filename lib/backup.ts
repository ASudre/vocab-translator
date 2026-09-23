import { UserProgress } from './indexedDB';

export const BACKUP_VERSION = 1;

export interface BackupPayload {
  version: number;
  exportedAt: string;
  progress: Omit<UserProgress, 'id'>[];
}

/**
 * Vocabulary content itself isn't backed up - it's re-derived from the
 * static level JSON files on next load. Only progress (mastery/streaks)
 * needs preserving. The local autoIncrement `id` is stripped: it's a
 * device-local key that would be meaningless (or collide) on another
 * device or after a restore, since restoreUserProgress lets IndexedDB
 * assign fresh ones.
 */
export const buildBackupPayload = (allProgress: UserProgress[], now: Date = new Date()): BackupPayload => ({
  version: BACKUP_VERSION,
  exportedAt: now.toISOString(),
  progress: allProgress.map(row => {
    const rest: Omit<UserProgress, 'id'> & { id?: number } = { ...row };
    delete rest.id;
    return rest;
  }),
});

const isValidProgressRow = (value: unknown): value is Omit<UserProgress, 'id'> => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.vocabularyId === 'number' &&
    typeof candidate.successCount === 'number' &&
    typeof candidate.failCount === 'number' &&
    typeof candidate.bestStreak === 'number' &&
    typeof candidate.currentStreak === 'number' &&
    typeof candidate.lastPracticed === 'string' &&
    Array.isArray(candidate.attemptHistory) &&
    typeof candidate.masteryLevel === 'number'
  );
};

/**
 * Validates an untrusted payload (downloaded from Drive - could be an old
 * format, or tampered with, or just not this app's file) before any of it
 * is ever written to IndexedDB. Returns null for anything that doesn't
 * match exactly, rather than trying to coerce a best effort out of it.
 */
export const parseBackupPayload = (value: unknown): BackupPayload | null => {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;

  if (candidate.version !== BACKUP_VERSION) return null;
  if (typeof candidate.exportedAt !== 'string') return null;
  if (!Array.isArray(candidate.progress) || !candidate.progress.every(isValidProgressRow)) return null;

  return {
    version: candidate.version,
    exportedAt: candidate.exportedAt,
    progress: candidate.progress as Omit<UserProgress, 'id'>[],
  };
};
