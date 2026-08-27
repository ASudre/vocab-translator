import { describe, it, expect } from 'vitest';
import {
  ATTEMPT_HISTORY_SIZE,
  MASTERY_THRESHOLD,
  appendAttempt,
  computeMasteryLevel,
  computeNextProgress,
  computeMasteryStats,
  selectUnmastered,
  normalizeVocabularyEntries,
  needsVocabularyReload,
} from '@/lib/progress';
import { UserProgress, VocabularyEntry } from '@/lib/indexedDB';

describe('appendAttempt', () => {
  it('appends to an empty/undefined history', () => {
    expect(appendAttempt(undefined, true)).toEqual([true]);
  });

  it('keeps only the most recent ATTEMPT_HISTORY_SIZE entries', () => {
    const history = [true, false, true];
    expect(history.length).toBe(ATTEMPT_HISTORY_SIZE);
    expect(appendAttempt(history, false)).toEqual([false, true, false]);
  });
});

describe('computeMasteryLevel', () => {
  it('is 0 for an empty history', () => {
    expect(computeMasteryLevel([])).toBe(0);
  });

  it('counts only trailing consecutive successes', () => {
    expect(computeMasteryLevel([true, false, true])).toBe(1);
    expect(computeMasteryLevel([false, true, true])).toBe(2);
    expect(computeMasteryLevel([true, true, true])).toBe(3);
    expect(computeMasteryLevel([false, false, false])).toBe(0);
  });
});

describe('computeNextProgress', () => {
  it('creates a fresh record on the first correct attempt', () => {
    const result = computeNextProgress(undefined, true, '2026-01-01T00:00:00.000Z');
    expect(result).toMatchObject({
      successCount: 1,
      failCount: 0,
      currentStreak: 1,
      bestStreak: 1,
      attemptHistory: [true],
      masteryLevel: 1,
      lastPracticed: '2026-01-01T00:00:00.000Z',
    });
  });

  it('creates a fresh record on the first incorrect attempt', () => {
    const result = computeNextProgress(undefined, false, '2026-01-01T00:00:00.000Z');
    expect(result).toMatchObject({
      successCount: 0,
      failCount: 1,
      currentStreak: 0,
      bestStreak: 0,
      attemptHistory: [false],
      masteryLevel: 0,
    });
  });

  it('increments streak and mastery on a correct attempt', () => {
    const existing: UserProgress = {
      id: 1,
      vocabularyId: 42,
      successCount: 1,
      failCount: 0,
      currentStreak: 1,
      bestStreak: 1,
      lastPracticed: '2026-01-01T00:00:00.000Z',
      attemptHistory: [true],
      masteryLevel: 1,
    };
    const result = computeNextProgress(existing, true, '2026-01-02T00:00:00.000Z');
    expect(result).toMatchObject({
      successCount: 2,
      failCount: 0,
      currentStreak: 2,
      bestStreak: 2,
      attemptHistory: [true, true],
      masteryLevel: 2,
    });
  });

  it('resets currentStreak but retains bestStreak on a failure', () => {
    const existing: UserProgress = {
      id: 1,
      vocabularyId: 42,
      successCount: 2,
      failCount: 0,
      currentStreak: 2,
      bestStreak: 2,
      lastPracticed: '2026-01-01T00:00:00.000Z',
      attemptHistory: [true, true],
      masteryLevel: 2,
    };
    const result = computeNextProgress(existing, false, '2026-01-02T00:00:00.000Z');
    expect(result).toMatchObject({
      successCount: 2,
      failCount: 1,
      currentStreak: 0,
      bestStreak: 2, // best streak is retained even after a reset
      attemptHistory: [true, true, false],
      masteryLevel: 0,
    });
  });

  it('truncates attemptHistory to a rolling window of ATTEMPT_HISTORY_SIZE', () => {
    const existing: UserProgress = {
      id: 1,
      vocabularyId: 42,
      successCount: 3,
      failCount: 0,
      currentStreak: 3,
      bestStreak: 3,
      lastPracticed: '2026-01-01T00:00:00.000Z',
      attemptHistory: [true, true, true],
      masteryLevel: 3,
    };
    const result = computeNextProgress(existing, true, '2026-01-02T00:00:00.000Z');
    expect(result.attemptHistory).toHaveLength(ATTEMPT_HISTORY_SIZE);
    expect(result.attemptHistory).toEqual([true, true, true]);
    expect(result.masteryLevel).toBe(MASTERY_THRESHOLD);
  });
});

describe('computeMasteryStats', () => {
  it('returns zeroes when the level has no words', () => {
    expect(computeMasteryStats(new Set(), [])).toEqual({ total: 0, mastered: 0, percentage: 0 });
  });

  const progressAt = (vocabularyId: number, masteryLevel: number): UserProgress => ({
    vocabularyId,
    successCount: masteryLevel,
    failCount: 0,
    currentStreak: masteryLevel,
    bestStreak: masteryLevel,
    lastPracticed: '2026-01-01T00:00:00.000Z',
    attemptHistory: [],
    masteryLevel,
  });

  it('computes percentage from summed mastery points out of totalWords * MASTERY_THRESHOLD', () => {
    const ids = new Set([1, 2]);
    const progress = [progressAt(1, 3), progressAt(2, 0)];
    const result = computeMasteryStats(ids, progress);
    expect(result.total).toBe(2);
    expect(result.mastered).toBe(1);
    expect(result.percentage).toBe(50);
  });

  it('rounds the percentage to one decimal place', () => {
    const ids = new Set([1, 2, 3]);
    const progress = [progressAt(1, 1), progressAt(2, 0), progressAt(3, 0)];
    const result = computeMasteryStats(ids, progress);
    // 1 point out of 9 possible = 11.111...% -> rounds to 11.1
    expect(result.percentage).toBe(11.1);
  });

  it('excludes progress records belonging to other levels', () => {
    const ids = new Set([1]); // only word 1 belongs to this level
    const progress = [progressAt(1, 3), progressAt(999, 3)]; // 999 is from another level
    const result = computeMasteryStats(ids, progress);
    expect(result.total).toBe(1);
    expect(result.mastered).toBe(1);
    expect(result.percentage).toBe(100);
  });
});

describe('selectUnmastered', () => {
  const vocab: VocabularyEntry[] = [1, 2, 3, 4, 5].map(id => ({
    id,
    English: `en${id}`,
    Español: `es${id}`,
    Français: `fr${id}`,
    Category: 'cat',
    Class: 'noun',
  }));

  it('excludes mastered word ids', () => {
    const result = selectUnmastered(vocab, new Set([1, 2]), 10, () => 0);
    expect(result.map(v => v.id).sort()).toEqual([3, 4, 5]);
  });

  it('returns at most `count` entries', () => {
    const result = selectUnmastered(vocab, new Set(), 2, () => 0);
    expect(result).toHaveLength(2);
  });

  it('returns fewer than `count` when the pool is smaller', () => {
    const result = selectUnmastered(vocab, new Set([1, 2, 3, 4]), 10, () => 0);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(5);
  });

  it('returns an empty array when every word is mastered', () => {
    const result = selectUnmastered(vocab, new Set([1, 2, 3, 4, 5]), 10, () => 0);
    expect(result).toEqual([]);
  });

  it('is deterministic for a fixed random function (regression pin, not a claim about shuffle quality)', () => {
    const a = selectUnmastered(vocab, new Set(), 5, () => 0.5);
    const b = selectUnmastered(vocab, new Set(), 5, () => 0.5);
    expect(a).toEqual(b);
  });
});

describe('normalizeVocabularyEntries', () => {
  it('normalizes a bare array using lowercase field names', () => {
    const result = normalizeVocabularyEntries([
      { id: 1, spanish: 'hola', french: 'bonjour', english: 'hello', category: 'greeting', class: 'interjection' },
    ]);
    expect(result).toEqual([
      { id: 1, English: 'hello', Español: 'hola', Français: 'bonjour', Category: 'greeting', Class: 'interjection' },
    ]);
  });

  it('normalizes { list: [...] } using accented capitalized field names', () => {
    const result = normalizeVocabularyEntries({
      version: '1.0.0',
      list: [{ id: 2, Español: 'adios', Français: 'au revoir', English: 'goodbye', Category: 'greeting', Class: 'interjection' }],
    });
    expect(result).toEqual([
      { id: 2, English: 'goodbye', Español: 'adios', Français: 'au revoir', Category: 'greeting', Class: 'interjection' },
    ]);
  });

  it('defaults missing fields to an empty string', () => {
    const result = normalizeVocabularyEntries([{ id: 3 }]);
    expect(result).toEqual([{ id: 3, English: '', Español: '', Français: '', Category: '', Class: '' }]);
  });

  it('returns an empty array when list is missing from an object payload', () => {
    expect(normalizeVocabularyEntries({ version: '1.0.0' })).toEqual([]);
  });
});

describe('needsVocabularyReload', () => {
  it('reloads when nothing is currently loaded', () => {
    expect(needsVocabularyReload({ count: 0, activeLevel: null, level: 'a1', storedVersion: null, jsonVersion: '1.0.0' })).toBe(true);
  });

  it('does not reload when the same level and version are already loaded', () => {
    expect(needsVocabularyReload({ count: 10, activeLevel: 'a1', level: 'a1', storedVersion: '1.0.0', jsonVersion: '1.0.0' })).toBe(false);
  });

  it('reloads when the active level differs', () => {
    expect(needsVocabularyReload({ count: 10, activeLevel: 'a1', level: 'a2', storedVersion: '1.0.0', jsonVersion: '1.0.0' })).toBe(true);
  });

  it('reloads when the stored version differs from the fetched version', () => {
    expect(needsVocabularyReload({ count: 10, activeLevel: 'a1', level: 'a1', storedVersion: '1.0.0', jsonVersion: '1.0.1' })).toBe(true);
  });
});
