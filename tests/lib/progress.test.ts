import { describe, it, expect } from 'vitest';
import {
  ATTEMPT_HISTORY_SIZE,
  MASTERY_THRESHOLD,
  appendAttempt,
  computeMasteryLevel,
  computeNextProgress,
  computeMasteryStats,
  computeLifetimeWordsCorrect,
  computeMasteredToday,
  levelForVocabularyId,
  pickRandom,
  selectUnmastered,
  selectMastered,
  normalizeVocabularyEntries,
  needsVocabularyReload,
} from '@/lib/progress';
import { UserProgress, VocabularyEntry } from '@/lib/indexedDB';

describe('levelForVocabularyId', () => {
  it('maps an id to the level whose 10000-wide block contains it', () => {
    expect(levelForVocabularyId(1)).toBe('a1');
    expect(levelForVocabularyId(1737)).toBe('a1');
    expect(levelForVocabularyId(10001)).toBe('a2');
    expect(levelForVocabularyId(20993)).toBe('b1');
    expect(levelForVocabularyId(30001)).toBe('b2');
    expect(levelForVocabularyId(40708)).toBe('c1');
  });

  it('throws for an id outside every known block', () => {
    expect(() => levelForVocabularyId(50000)).toThrow();
  });
});

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

  it('sets masteredAt on the transition into mastery', () => {
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
    const result = computeNextProgress(existing, true, '2026-01-02T00:00:00.000Z');
    expect(result.masteryLevel).toBe(MASTERY_THRESHOLD);
    expect(result.masteredAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('does not move masteredAt when an already-mastered word is answered correctly again (revision)', () => {
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
      masteredAt: '2026-01-01T00:00:00.000Z',
    };
    const result = computeNextProgress(existing, true, '2026-03-05T00:00:00.000Z');
    expect(result.masteryLevel).toBe(MASTERY_THRESHOLD);
    expect(result.lastPracticed).toBe('2026-03-05T00:00:00.000Z');
    expect(result.masteredAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('preserves the stale masteredAt when a mastered word is demoted by a wrong answer', () => {
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
      masteredAt: '2026-01-01T00:00:00.000Z',
    };
    const result = computeNextProgress(existing, false, '2026-03-05T00:00:00.000Z');
    expect(result.masteryLevel).toBe(0);
    // Stale on purpose: computeMasteredToday gates on masteryLevel === 3, so a
    // demoted word's leftover masteredAt is never read until it re-masters
    // and overwrites it.
    expect(result.masteredAt).toBe('2026-01-01T00:00:00.000Z');
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

describe('computeLifetimeWordsCorrect', () => {
  const progressWith = (vocabularyId: number, successCount: number): UserProgress => ({
    vocabularyId,
    successCount,
    failCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPracticed: '2026-01-01T00:00:00.000Z',
    attemptHistory: [],
    masteryLevel: 0,
  });

  it('is 0 with no progress records', () => {
    expect(computeLifetimeWordsCorrect([])).toBe(0);
  });

  it('counts only words with at least one success, ever', () => {
    const progress = [progressWith(1, 3), progressWith(2, 0), progressWith(3, 1)];
    expect(computeLifetimeWordsCorrect(progress)).toBe(2);
  });

  it('is not scoped to a single level, unlike computeMasteryStats', () => {
    // ids from very different level ranges (a1 vs c1), all counted together
    const progress = [progressWith(1, 5), progressWith(20001, 2), progressWith(40001, 1)];
    expect(computeLifetimeWordsCorrect(progress)).toBe(3);
  });
});

describe('computeMasteredToday', () => {
  const progressAt = (vocabularyId: number, masteryLevel: number, masteredAt: string | undefined, lastPracticed = masteredAt ?? '2026-03-05T08:00:00.000Z'): UserProgress => ({
    vocabularyId,
    successCount: masteryLevel,
    failCount: 0,
    currentStreak: masteryLevel,
    bestStreak: masteryLevel,
    lastPracticed,
    attemptHistory: [],
    masteryLevel,
    masteredAt,
  });

  const today = new Date('2026-03-05T12:00:00.000Z');

  it('is 0 with no progress records', () => {
    expect(computeMasteredToday([], today)).toBe(0);
  });

  it('counts only words mastered (3 consecutive successes) with masteredAt today', () => {
    const progress = [
      progressAt(1, MASTERY_THRESHOLD, '2026-03-05T08:00:00.000Z'), // mastered today
      progressAt(2, MASTERY_THRESHOLD, '2026-03-04T08:00:00.000Z'), // mastered yesterday
      progressAt(3, 2, undefined), // not yet mastered
    ];
    expect(computeMasteredToday(progress, today)).toBe(1);
  });

  it('does not count a word mastered yesterday but revised (lastPracticed bumped) today', () => {
    const progress = [
      progressAt(1, MASTERY_THRESHOLD, '2026-03-04T08:00:00.000Z', '2026-03-05T09:00:00.000Z'),
    ];
    expect(computeMasteredToday(progress, today)).toBe(0);
  });

  it('is not scoped to a single level', () => {
    const progress = [
      progressAt(1, MASTERY_THRESHOLD, '2026-03-05T08:00:00.000Z'),
      progressAt(40001, MASTERY_THRESHOLD, '2026-03-05T09:00:00.000Z'),
    ];
    expect(computeMasteredToday(progress, today)).toBe(2);
  });
});

describe('pickRandom', () => {
  const entries = [1, 2, 3, 4, 5];

  it('returns at most `count` entries', () => {
    expect(pickRandom(entries, 2, () => 0)).toHaveLength(2);
  });

  it('returns fewer than `count` when the pool is smaller', () => {
    expect(pickRandom(entries, 10, () => 0)).toHaveLength(5);
  });

  it('is deterministic for a fixed random function (regression pin, not a claim about shuffle quality)', () => {
    const a = pickRandom(entries, 5, () => 0.5);
    const b = pickRandom(entries, 5, () => 0.5);
    expect(a).toEqual(b);
  });
});

const makeVocab = (ids: number[], level: VocabularyEntry['level'] = 'a1'): VocabularyEntry[] =>
  ids.map(id => ({
    id,
    English: `en${id}`,
    Español: `es${id}`,
    Français: `fr${id}`,
    Category: 'cat',
    Class: 'noun',
    level,
  }));

describe('selectUnmastered', () => {
  const vocab = makeVocab([1, 2, 3, 4, 5]);

  it('excludes mastered word ids', () => {
    const result = selectUnmastered(vocab, new Set([1, 2]), 10, () => 0);
    expect(result.map(v => v.id).sort()).toEqual([3, 4, 5]);
  });

  it('returns an empty array when every word is mastered', () => {
    const result = selectUnmastered(vocab, new Set([1, 2, 3, 4, 5]), 10, () => 0);
    expect(result).toEqual([]);
  });
});

describe('selectMastered', () => {
  const vocab = makeVocab([1, 2, 3, 4, 5]);
  const practicedAt = (vocabularyId: number, lastPracticed: string) => ({ vocabularyId, lastPracticed });

  it('orders results oldest-practiced-first', () => {
    const progress = [
      practicedAt(1, '2026-03-03T00:00:00.000Z'),
      practicedAt(2, '2026-03-01T00:00:00.000Z'),
      practicedAt(3, '2026-03-02T00:00:00.000Z'),
    ];
    const result = selectMastered(vocab, progress, 10);
    expect(result.map(v => v.id)).toEqual([2, 3, 1]);
  });

  it('only includes ids with mastered progress, ignoring the rest of allVocab', () => {
    const progress = [practicedAt(1, '2026-03-01T00:00:00.000Z'), practicedAt(2, '2026-03-02T00:00:00.000Z')];
    const result = selectMastered(vocab, progress, 10);
    expect(result.map(v => v.id)).toEqual([1, 2]);
  });

  it('drops a mastered id whose vocabulary entry is not in allVocab', () => {
    const progress = [practicedAt(1, '2026-03-01T00:00:00.000Z'), practicedAt(999, '2026-03-02T00:00:00.000Z')];
    const result = selectMastered(vocab, progress, 10);
    expect(result.map(v => v.id)).toEqual([1]);
  });

  it('returns at most `count`, keeping the oldest', () => {
    const progress = [
      practicedAt(1, '2026-03-03T00:00:00.000Z'),
      practicedAt(2, '2026-03-01T00:00:00.000Z'),
      practicedAt(3, '2026-03-02T00:00:00.000Z'),
    ];
    const result = selectMastered(vocab, progress, 2);
    expect(result.map(v => v.id)).toEqual([2, 3]);
  });

  it('returns an empty array when nothing is mastered', () => {
    expect(selectMastered(vocab, [], 10)).toEqual([]);
  });
});

describe('normalizeVocabularyEntries', () => {
  it('normalizes a bare array using lowercase field names, stamped with the given level', () => {
    const result = normalizeVocabularyEntries([
      { id: 1, spanish: 'hola', french: 'bonjour', english: 'hello', category: 'greeting', class: 'interjection' },
    ], 'a1');
    expect(result).toEqual([
      { id: 1, English: 'hello', Español: 'hola', Français: 'bonjour', Category: 'greeting', Class: 'interjection', level: 'a1' },
    ]);
  });

  it('normalizes { list: [...] } using accented capitalized field names', () => {
    const result = normalizeVocabularyEntries({
      version: '1.0.0',
      list: [{ id: 2, Español: 'adios', Français: 'au revoir', English: 'goodbye', Category: 'greeting', Class: 'interjection' }],
    }, 'a2');
    expect(result).toEqual([
      { id: 2, English: 'goodbye', Español: 'adios', Français: 'au revoir', Category: 'greeting', Class: 'interjection', level: 'a2' },
    ]);
  });

  it('defaults missing fields to an empty string', () => {
    const result = normalizeVocabularyEntries([{ id: 3 }], 'a1');
    expect(result).toEqual([{ id: 3, English: '', Español: '', Français: '', Category: '', Class: '', level: 'a1' }]);
  });

  it('returns an empty array when list is missing from an object payload', () => {
    expect(normalizeVocabularyEntries({ version: '1.0.0' }, 'a1')).toEqual([]);
  });
});

describe('needsVocabularyReload', () => {
  it('reloads when the level has nothing loaded yet', () => {
    expect(needsVocabularyReload({ levelCount: 0, storedVersion: null, jsonVersion: '1.0.0' })).toBe(true);
  });

  it('does not reload when the level is loaded and its version matches', () => {
    expect(needsVocabularyReload({ levelCount: 10, storedVersion: '1.0.0', jsonVersion: '1.0.0' })).toBe(false);
  });

  it('reloads when the stored version differs from the fetched version', () => {
    expect(needsVocabularyReload({ levelCount: 10, storedVersion: '1.0.0', jsonVersion: '1.0.1' })).toBe(true);
  });
});
