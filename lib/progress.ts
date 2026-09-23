import { UserProgress, VocabularyEntry } from './indexedDB';
import { localDayKey } from './dailyGoal';
import { CEFR_LEVELS, CEFRLevel } from './levels';

/** Number of most-recent attempts retained per word. */
export const ATTEMPT_HISTORY_SIZE = 3;

/** Number of trailing consecutive successes required to consider a word mastered. */
export const MASTERY_THRESHOLD = 3;

/**
 * Every level's ids fall inside a dedicated 10000-wide block (a1: 0-9999,
 * a2: 10000-19999, ...), enforced by tests/data/vocabulary.test.ts. This
 * lets a word's level be recovered from its id alone, which the v6
 * IndexedDB migration relies on to backfill VocabularyEntry.level for rows
 * that predate the field, and which the revision page relies on to resolve
 * which levels' JSON to (re)load for a mastered-id whose entry isn't
 * resident yet.
 */
export const levelForVocabularyId = (id: number): CEFRLevel => {
  const block = Math.floor(id / 10000);
  const level = CEFR_LEVELS[block];
  if (!level) {
    throw new Error(`No CEFR level maps to vocabulary id ${id}`);
  }
  return level;
};

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
    const newMasteryLevel = computeMasteryLevel(newAttemptHistory);
    // masteredAt marks the moment a word most recently transitioned INTO
    // mastery, so it (unlike lastPracticed) isn't disturbed by later
    // revision attempts on an already-mastered word. See computeMasteredToday.
    const masteredAt =
      newMasteryLevel === MASTERY_THRESHOLD && existing.masteryLevel !== MASTERY_THRESHOLD
        ? now
        : existing.masteredAt;
    // demotedAt marks the moment a word most recently transitioned OUT of
    // mastery (a revision miss). See computeDemotedToday.
    const demotedAt =
      newMasteryLevel !== MASTERY_THRESHOLD && existing.masteryLevel === MASTERY_THRESHOLD
        ? now
        : existing.demotedAt;

    return {
      id: existing.id,
      vocabularyId: existing.vocabularyId,
      successCount: existing.successCount + (isCorrect ? 1 : 0),
      failCount: existing.failCount + (isCorrect ? 0 : 1),
      currentStreak: newCurrentStreak,
      bestStreak: newBestStreak,
      lastPracticed: now,
      attemptHistory: newAttemptHistory,
      masteryLevel: newMasteryLevel,
      masteredAt,
      demotedAt,
    };
  }

  const attemptHistory = appendAttempt(undefined, isCorrect);
  const masteryLevel = computeMasteryLevel(attemptHistory);

  return {
    vocabularyId: -1, // caller must overwrite with the real vocabularyId
    successCount: isCorrect ? 1 : 0,
    failCount: isCorrect ? 0 : 1,
    currentStreak: isCorrect ? 1 : 0,
    bestStreak: isCorrect ? 1 : 0,
    lastPracticed: now,
    attemptHistory,
    masteryLevel,
    masteredAt: masteryLevel === MASTERY_THRESHOLD ? now : undefined,
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
 * Lifetime count of distinct words ever answered correctly at least once,
 * across every level ever practiced (unlike computeMasteryStats, this is
 * intentionally not scoped to one level's ids). successCount is a per-word
 * counter that's never reset, so successCount > 0 means "gotten right at
 * least once, ever."
 */
export const computeLifetimeWordsCorrect = (allProgress: UserProgress[]): number =>
  allProgress.filter(p => p.successCount > 0).length;

/**
 * Count of words mastered (3 consecutive correct answers) on `today`, across
 * every level. Unlike lastPracticed, masteredAt only moves on the transition
 * INTO mastery, so revising an already-mastered word on the revision page
 * doesn't inflate this count.
 */
export const computeMasteredToday = (allProgress: UserProgress[], today: Date = new Date()): number => {
  const todayKey = localDayKey(today);
  return allProgress.filter(
    p => p.masteryLevel === MASTERY_THRESHOLD && p.masteredAt && localDayKey(new Date(p.masteredAt)) === todayKey
  ).length;
};

/**
 * Words demoted (sent back to learning by a revision miss) specifically on
 * `today`, scoped to the given level. Needs demotedAt - the moment a word
 * most recently transitioned OUT of mastery - since masteredAt alone can't
 * say when the demotion happened. Rows demoted before this field existed
 * simply have no demotedAt and are never counted, which is correct: whether
 * they were demoted "today" is unknowable.
 */
export const computeDemotedToday = (
  allProgress: UserProgress[],
  today: Date = new Date(),
  level: CEFRLevel
): number => {
  const todayKey = localDayKey(today);
  return allProgress.filter(p =>
    p.masteryLevel !== MASTERY_THRESHOLD &&
    p.demotedAt &&
    localDayKey(new Date(p.demotedAt)) === todayKey &&
    levelForVocabularyId(p.vocabularyId) === level
  ).length;
};

/**
 * Return a random selection of up to `count` entries via Fisher-Yates
 * shuffle. `random` is injectable so tests can pin the shuffle outcome.
 */
export const pickRandom = <T,>(entries: T[], count: number, random: () => number = Math.random): T[] => {
  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
};

/** Filter out mastered words and return a random selection of up to `count`. */
export const selectUnmastered = (
  allVocab: VocabularyEntry[],
  masteredIds: Set<number>,
  count: number,
  random: () => number = Math.random
): VocabularyEntry[] =>
  pickRandom(allVocab.filter(vocab => !masteredIds.has(vocab.id)), count, random);

/**
 * Order mastered words oldest-practiced-first for revision, and return up to
 * `count`. lastPracticed updates on every attempt regardless of mode, so a
 * word not yet revised sits at the moment it was mastered (lastPracticed ===
 * masteredAt then), and any correct revision answer pushes it to the back of
 * the queue by bumping lastPracticed again - no separate "last reviewed"
 * field needed.
 */
export const selectMastered = (
  allVocab: VocabularyEntry[],
  masteredProgress: Pick<UserProgress, 'vocabularyId' | 'lastPracticed'>[],
  count: number
): VocabularyEntry[] => {
  const vocabById = new Map(allVocab.map(entry => [entry.id, entry]));

  return masteredProgress
    .slice()
    .sort((a, b) => a.lastPracticed.localeCompare(b.lastPracticed))
    .map(p => vocabById.get(p.vocabularyId))
    .filter((entry): entry is VocabularyEntry => entry !== undefined)
    .slice(0, count);
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
 * names) into the canonical VocabularyEntry shape, stamped with the level
 * it was loaded for (the vocabulary store now holds every visited level at
 * once, so entries need to say which level they belong to).
 */
export const normalizeVocabularyEntries = (
  jsonData: RawVocabularyJSON | RawVocabularyEntry[],
  level: CEFRLevel
): VocabularyEntry[] => {
  const rawData: RawVocabularyEntry[] = Array.isArray(jsonData) ? jsonData : jsonData.list || [];

  return rawData.map(entry => ({
    id: entry.id,
    English: entry.english || entry.English || '',
    Español: entry.spanish || entry.Español || '',
    Français: entry.french || entry.Français || '',
    Category: entry.category || entry.Category || '',
    Class: entry.class || entry.Class || '',
    level,
  }));
};

/**
 * Decide whether a level's vocabulary needs to be (re)loaded into
 * IndexedDB: either that level isn't loaded yet, or its stored version
 * doesn't match the fetched JSON's version. Scoped per-level (rather than to
 * whatever level was last active) since the vocabulary store now keeps every
 * visited level resident at once.
 */
export const needsVocabularyReload = (params: {
  levelCount: number;
  storedVersion: string | null;
  jsonVersion: string;
}): boolean => {
  const { levelCount, storedVersion, jsonVersion } = params;
  if (levelCount === 0) return true;
  return storedVersion !== jsonVersion;
};
