import { CEFR_LEVELS, CEFRLevel, TranslationResult } from '@/hooks/useVocabularyDB';

export const LEVEL_STORAGE_KEY = 'vocabDB_selectedLevel';

export const pendingWordKey = (level: CEFRLevel) => `vocabDB_pendingWord_${level}`;

export const isCEFRLevel = (value: string | null): value is CEFRLevel =>
  value !== null && (CEFR_LEVELS as readonly string[]).includes(value);

/**
 * Read back whichever word was mid-attempt when the app last closed, for the
 * given level. Self-heals on malformed JSON (clears the stored key), but
 * does not validate the shape of well-formed JSON.
 */
export const readPendingWord = (level: CEFRLevel): TranslationResult | null => {
  const raw = localStorage.getItem(pendingWordKey(level));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as TranslationResult;
  } catch {
    localStorage.removeItem(pendingWordKey(level));
    return null;
  }
};
