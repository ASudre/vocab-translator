import { useCallback, useEffect, useRef, useState } from 'react';
import { TranslationResult } from '@/hooks/useVocabularyDB';
import { useCardNavigation } from '@/hooks/useCardNavigation';
import { checkAnswerCorrectness } from '@/lib/helpers';
import { saveUserProgress } from '@/lib/indexedDB';
import { appendAttempt } from '@/lib/progress';
import { writePendingWord, clearPendingWord } from '@/lib/pendingWord';

/** How a practice session gets its words. Learning and revision each supply their own. */
export interface WordSource {
  /** Identifies this word queue for pending-word persistence (a CEFR level, or 'revise_a1' / 'revise_all'). */
  sessionKey: string;
  /** Whether the underlying IndexedDB level(s) have finished loading. */
  ready: boolean;
  fetchBatch: (count: number, excludeIds: number[]) => Promise<TranslationResult[]>;
}

interface PracticeSessionConfig {
  source: WordSource;
  /** The word left mid-attempt when the app last closed for this session, if any - see lib/pendingWord.ts. */
  pendingWord: TranslationResult | null;
  batchSize?: number;
  recordCombo: (isCorrect: boolean) => void;
  recordDailyGoal: (vocabularyId: number) => void;
  /** Called after progress is saved for the first attempt on a word, e.g. to refresh mastery stats. */
  onAttemptSaved?: () => void | Promise<void>;
}

// A session's word list only ever grows by appending fetched batches, so
// without a cap a long-running session (revision cycling a small pool
// indefinitely) would leak memory. Comfortably larger than any single batch.
const MAX_WORDS_RETAINED = 50;

export const usePracticeSession = ({
  source,
  pendingWord,
  batchSize = 10,
  recordCombo,
  recordDailyGoal,
  onAttemptSaved,
}: PracticeSessionConfig) => {
  const [words, setWords] = useState<TranslationResult[]>([]);
  const [loading, setLoading] = useState(false);
  // Whether at least one fetch has completed for the current session - lets
  // a caller distinguish "still loading the first batch" from "loaded, and
  // the pool is genuinely empty" (revision's session-complete state).
  const [fetchedOnce, setFetchedOnce] = useState(false);

  const {
    currentIndex,
    slideDirection,
    shakeAnimation,
    goToNext,
    triggerShake,
    autoAdvance,
    reset: resetNavigation,
  } = useCardNavigation(words.length);

  const currentWord = words[currentIndex];

  const fetchWords = useCallback(async (excludeIds: number[] = []) => {
    if (!source.ready) return;

    setLoading(true);
    try {
      const newWords = await source.fetchBatch(batchSize, excludeIds);
      setWords(prevWords => [...prevWords, ...newWords].slice(-MAX_WORDS_RETAINED));
    } catch (error) {
      console.error('Error loading vocabulary:', error);
    } finally {
      setLoading(false);
      setFetchedOnce(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.ready, source.fetchBatch, batchSize]);

  // Switching sessions (level, or revision scope) starts a clean queue -
  // otherwise the previous session's words/position would flash before the
  // new source's first batch lands.
  useEffect(() => {
    setWords([]);
    setFetchedOnce(false);
    resetNavigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.sessionKey]);

  // Resume the previously unfinished word first, instead of a fresh shuffle,
  // so closing the app isn't a free way to dodge a word you don't want to answer.
  useEffect(() => {
    if (!source.ready) return;

    if (pendingWord) {
      setWords([pendingWord]);
      fetchWords([pendingWord.vocabularyId]);
    } else {
      fetchWords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.ready, source.sessionKey, pendingWord]);

  useEffect(() => {
    const wordsRemaining = words.length - currentIndex;
    if (wordsRemaining === 1 && !loading) {
      fetchWords();
    }
  }, [currentIndex, words.length, loading, fetchWords]);

  // Remember whichever word is currently on screen but hasn't had an attempt
  // recorded yet (progressSaved). If the app gets killed before it's
  // answered, this word reappears on relaunch instead of a fresh shuffle
  // quietly dropping it. Keyed on vocabularyId/progressSaved (not the whole
  // word) so this doesn't write to localStorage on every keystroke, only
  // when the word or its saved state changes.
  useEffect(() => {
    if (!currentWord) return;

    if (currentWord.progressSaved) {
      clearPendingWord(source.sessionKey);
    } else {
      writePendingWord(source.sessionKey, currentWord);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord?.vocabularyId, currentWord?.progressSaved, source.sessionKey]);

  const currentWordRef = useRef(currentWord);
  currentWordRef.current = currentWord;

  useEffect(() => {
    return () => {
      const word = currentWordRef.current;
      if (word && !word.progressSaved) {
        writePendingWord(source.sessionKey, word);
      }
    };
  }, [source.sessionKey]);

  const handleKeyPress = useCallback((key: string) => {
    setWords(prevWords => {
      const newWords = [...prevWords];
      const currentValue = newWords[currentIndex].userAnswer || '';
      newWords[currentIndex] = {
        ...newWords[currentIndex],
        userAnswer: currentValue + key,
        isCorrect: null
      };
      return newWords;
    });
  }, [currentIndex]);

  const handleBackspace = useCallback(() => {
    setWords(prevWords => {
      const newWords = [...prevWords];
      const currentValue = newWords[currentIndex].userAnswer || '';
      newWords[currentIndex] = {
        ...newWords[currentIndex],
        userAnswer: currentValue.slice(0, -1),
        isCorrect: null
      };
      return newWords;
    });
  }, [currentIndex]);

  const handleClear = useCallback(() => {
    setWords(prevWords => {
      const newWords = [...prevWords];
      newWords[currentIndex] = {
        ...newWords[currentIndex],
        userAnswer: '',
        isCorrect: null
      };
      return newWords;
    });
  }, [currentIndex]);

  const handleCheckAnswer = useCallback(async () => {
    const word = words[currentIndex];
    const isCorrect = checkAnswerCorrectness(
      word.userAnswer || '',
      word.spanish
    );

    setWords(prevWords => {
      const newWords = [...prevWords];
      newWords[currentIndex] = {
        ...newWords[currentIndex],
        isCorrect,
        userAnswer: isCorrect ? newWords[currentIndex].userAnswer : ''
      };
      return newWords;
    });

    if (!word.progressSaved) {
      try {
        await saveUserProgress(word.vocabularyId, isCorrect);
        console.log(`Progress saved for word ${word.vocabularyId}: ${isCorrect ? 'correct' : 'incorrect'}`);

        setWords(prevWords => {
          const newWords = [...prevWords];
          newWords[currentIndex] = {
            ...newWords[currentIndex],
            progressSaved: true,
            attemptHistory: appendAttempt(newWords[currentIndex].attemptHistory, isCorrect)
          };
          return newWords;
        });

        await onAttemptSaved?.();
        recordCombo(isCorrect);
        if (isCorrect) {
          recordDailyGoal(word.vocabularyId);
        }
      } catch (error) {
        console.error('Failed to save progress:', error);
      }
    }

    if (isCorrect) {
      autoAdvance();
    } else {
      triggerShake();
    }
  }, [words, currentIndex, autoAdvance, triggerShake, onAttemptSaved, recordDailyGoal, recordCombo]);

  const handleToggleSolution = useCallback(async () => {
    const word = words[currentIndex];
    const wasNull = word.isCorrect === null;
    const willShowSolution = !word.showSolution;

    setWords(prevWords => {
      const newWords = [...prevWords];
      const current = newWords[currentIndex];

      newWords[currentIndex] = {
        ...current,
        showSolution: willShowSolution,
        // Mark as incorrect when showing solution (if not already answered)
        isCorrect: willShowSolution && wasNull ? false : current.isCorrect
      };
      return newWords;
    });

    if (willShowSolution && wasNull && !word.progressSaved) {
      try {
        await saveUserProgress(word.vocabularyId, false);
        console.log(`Progress saved for word ${word.vocabularyId}: incorrect (solution shown)`);

        setWords(prevWords => {
          const newWords = [...prevWords];
          newWords[currentIndex] = {
            ...newWords[currentIndex],
            progressSaved: true,
            attemptHistory: appendAttempt(newWords[currentIndex].attemptHistory, false)
          };
          return newWords;
        });

        await onAttemptSaved?.();
        recordCombo(false);
      } catch (error) {
        console.error('Failed to save progress:', error);
      }
    }
  }, [currentIndex, words, onAttemptSaved, recordCombo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentWord) return;
      // A focused interactive control (bottom nav link, level/scope select)
      // should keep its native keyboard behavior - Enter navigates a link
      // rather than being swallowed as "check answer".
      if ((e.target as HTMLElement | null)?.closest?.('a,button,select')) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleCheckAnswer();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleToggleSolution();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleKeyPress(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentWord, handleKeyPress, handleBackspace, handleCheckAnswer, handleToggleSolution, goToNext]);

  return {
    words,
    currentWord,
    currentIndex,
    loading,
    fetchedOnce,
    slideDirection,
    shakeAnimation,
    handleKeyPress,
    handleBackspace,
    handleClear,
    handleCheckAnswer,
    handleToggleSolution,
    goToNext,
    fetchWords,
  };
};

export type PracticeSession = ReturnType<typeof usePracticeSession>;
