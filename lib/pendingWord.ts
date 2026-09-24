import { CEFR_LEVELS, CEFRLevel, TranslationResult } from '@/hooks/useVocabularyDB';

export const LEVEL_STORAGE_KEY = 'vocabDB_selectedLevel';

/**
 * `sessionKey` identifies one practice session's word queue: a CEFR level
 * for learning (e.g. 'a1'), or 'revise_a1' / 'revise_all' for revision - see
 * usePracticeSession. Passing a bare level yields a byte-identical key to
 * before, so existing stored pending words survive.
 */
export const pendingWordKey = (sessionKey: string) => `vocabDB_pendingWord_${sessionKey}`;

export const isCEFRLevel = (value: string | null): value is CEFRLevel =>
  value !== null && (CEFR_LEVELS as readonly string[]).includes(value);

/**
 * Read back whichever word was mid-attempt when the app last closed, for the
 * given session. Self-heals on malformed JSON (clears the stored key), but
 * does not validate the shape of well-formed JSON.
 */
export const readPendingWord = (sessionKey: string): TranslationResult | null => {
  const raw = localStorage.getItem(pendingWordKey(sessionKey));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as TranslationResult;
  } catch {
    localStorage.removeItem(pendingWordKey(sessionKey));
    return null;
  }
};

/**
 * Persist the word currently on screen but not yet answered, so force-
 * quitting the app (or navigating to another tab, which unmounts this page
 * and its React state) can't be used to dodge it - a fresh shuffle would
 * otherwise quietly drop it. Whatever has been typed so far is kept as-is,
 * so switching tabs and coming back resumes mid-attempt.
 */
export const writePendingWord = (sessionKey: string, word: TranslationResult): void => {
  localStorage.setItem(pendingWordKey(sessionKey), JSON.stringify({
    vocabularyId: word.vocabularyId,
    spanish: word.spanish,
    french: word.french,
    class: word.class,
    category: word.category,
    userAnswer: word.userAnswer || '',
    isCorrect: null,
    showSolution: false,
    attemptHistory: word.attemptHistory,
    progressSaved: false,
  }));
};

export const clearPendingWord = (sessionKey: string): void => {
  localStorage.removeItem(pendingWordKey(sessionKey));
};
