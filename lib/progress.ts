import { UserProgress, VocabularyEntry } from './indexedDB';

/** Number of most-recent attempts retained per word. */
export const ATTEMPT_HISTORY_SIZE = 3;

/** Number of trailing consecutive successes required to consider a word mastered. */
export const MASTERY_THRESHOLD = 3;

/**
 * Append a new attempt to the rolling history, keeping only the most recent
 * ATTEMPT_HISTORY_SIZE entries.
 */
export const appendAttempt = (history: boolean[] | undefined, isCorrect: boolean): boolean[] =>
  [...(history || []), isCorrect].slice(-ATTEMPT_HISTORY_SIZE);

/**
 * Mastery level is the count of consecutive successes counted from the end
 * of the history (0-MASTERY_THRESHOLD). A single failure resets the count,
 * so [true, false, true] -> 1, not 2.
 */
export const computeMasteryLevel = (history: boolean[]): number => {
  let masteryLevel = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] === true) {
      masteryLevel++;
    } else {
      break;
    }
  }
  return masteryLevel;
};

/**
 * Compute the next UserProgress record for a word given whether the latest
 * attempt was correct. `now` is injected (rather than read internally) so
 * this stays pure and deterministic in tests.
 */
export const computeNextProgress = (
  existing: UserProgress | undefined,
  isCorrect: boolean,
  now: string
): UserProgress => {
  if (existing) {
    const newCurrentStreak = isCorrect ? existing.currentStreak + 1 : 0;
    const newBestStreak = Math.max(existing.bestStreak, newCurrentStreak);
    const newAttemptHistory = appendAttempt(existing.attemptHistory, isCorrect);

    return {
      id: existing.id,
      vocabularyId: existing.vocabularyId,
      successCount: existing.successCount + (isCorrect ? 1 : 0),
      failCount: existing.failCount + (isCorrect ? 0 : 1),
      currentStreak: newCurrentStreak,
      bestStreak: newBestStreak,
      lastPracticed: now,
      attemptHistory: newAttemptHistory,
      masteryLevel: computeMasteryLevel(newAttemptHistory),
    };
  }

  const attemptHistory = appendAttempt(undefined, isCorrect);

  return {
    vocabularyId: -1, // caller must overwrite with the real vocabularyId
    successCount: isCorrect ? 1 : 0,
    failCount: isCorrect ? 0 : 1,
    currentStreak: isCorrect ? 1 : 0,
    bestStreak: isCorrect ? 1 : 0,
    lastPracticed: now,
    attemptHistory,
    masteryLevel: computeMasteryLevel(attemptHistory),
  };
};

/**
 * Mastery stats scoped to a single level's word ids. The progress store
 * accumulates records across every level ever practiced, so callers must
 * pass only the ids belonging to the level being reported on.
 */
export const computeMasteryStats = (
  currentLevelIds: Set<number>,
  allProgress: UserProgress[]
): { total: number; mastered: number; percentage: number } => {
  const totalWords = currentLevelIds.size;
  const levelProgress = allProgress.filter(p => currentLevelIds.has(p.vocabularyId));

  const totalMasteryPoints = levelProgress.reduce((sum, progress) => sum + (progress.masteryLevel || 0), 0);
  const masteredWords = levelProgress.filter(p => p.masteryLevel === MASTERY_THRESHOLD).length;

  const maxPoints = totalWords * MASTERY_THRESHOLD;
  const percentage = maxPoints > 0 ? Math.round((totalMasteryPoints / maxPoints) * 1000) / 10 : 0;

  return { total: totalWords, mastered: masteredWords, percentage };
};

/**
 * Filter out mastered words and return a random selection of up to `count`
 * entries via Fisher-Yates shuffle. `random` is injectable so tests can pin
 * the shuffle outcome.
 */
export const selectUnmastered = (
  allVocab: VocabularyEntry[],
  masteredIds: Set<number>,
  count: number,
  random: () => number = Math.random
): VocabularyEntry[] => {
  const unmastered = allVocab.filter(vocab => !masteredIds.has(vocab.id));

  const shuffled = [...unmastered];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
};

/** Raw shape accepted from a level's JSON file: either a bare array or { list: [...] }. */
export interface RawVocabularyJSON {
  version?: string;
  list?: RawVocabularyEntry[];
}

export interface RawVocabularyEntry {
  id: number;
  spanish?: string;
  Español?: string;
  english?: string;
  English?: string;
  french?: string;
  Français?: string;
  category?: string;
  Category?: string;
  class?: string;
  Class?: string;
}

/**
 * Normalize a level's JSON payload (either a bare array of entries or
 * { list: [...] }, with either lowercase or accented-capitalized field
 * names) into the canonical VocabularyEntry shape.
 */
export const normalizeVocabularyEntries = (
  jsonData: RawVocabularyJSON | RawVocabularyEntry[]
): VocabularyEntry[] => {
  const rawData: RawVocabularyEntry[] = Array.isArray(jsonData) ? jsonData : jsonData.list || [];

  return rawData.map(entry => ({
    id: entry.id,
    English: entry.english || entry.English || '',
    Español: entry.spanish || entry.Español || '',
    Français: entry.french || entry.Français || '',
    Category: entry.category || entry.Category || '',
    Class: entry.class || entry.Class || '',
  }));
};

/**
 * Decide whether a level's vocabulary needs to be (re)loaded into
 * IndexedDB: either nothing is loaded yet, a different level is active, or
 * the stored version doesn't match the fetched JSON's version.
 */
export const needsVocabularyReload = (params: {
  count: number;
  activeLevel: string | null;
  level: string;
  storedVersion: string | null;
  jsonVersion: string;
}): boolean => {
  const { count, activeLevel, level, storedVersion, jsonVersion } = params;
  if (count === 0) return true;
  return activeLevel !== level || storedVersion !== jsonVersion;
};
