'use client';

import { useEffect, useCallback, useState } from 'react';
import { useVocabularyDB, CEFRLevel, TranslationResult } from '@/hooks/useVocabularyDB';
import { useCardNavigation } from '@/hooks/useCardNavigation';
import { checkAnswerCorrectness } from '@/lib/helpers';
import { saveUserProgress, getMasteryStats } from '@/lib/indexedDB';
import { appendAttempt } from '@/lib/progress';
import { LEVEL_STORAGE_KEY, pendingWordKey, isCEFRLevel, readPendingWord } from '@/lib/pendingWord';
import { VocabularyCard } from './components/VocabularyCard';
import { FixedKeyboard } from './components/FixedKeyboard';
import { TopBar } from './components/TopBar';

export default function Home() {
  const [level, setLevel] = useState<CEFRLevel>('a1');
  const [levelRestored, setLevelRestored] = useState(false);
  const [pendingWord, setPendingWord] = useState<TranslationResult | null>(null);
  const { words, setWords, loading, fetchWords, initialized } = useVocabularyDB(level, 10, levelRestored, pendingWord);
  const [masteryStats, setMasteryStats] = useState({ total: 0, mastered: 0, percentage: 0 });
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

  // Restore the previously selected level after mount, before letting
  // useVocabularyDB load anything. This can't be done via a useState lazy
  // initializer because localStorage isn't available during SSR — reading it
  // there would produce a value that mismatches the server-rendered 'a1'
  // default and break hydration. Gating on levelRestored (rather than just
  // setting the level here) avoids a race where the default 'a1' load and a
  // subsequent restored-level load both hit IndexedDB concurrently.
  useEffect(() => {
    const stored = localStorage.getItem(LEVEL_STORAGE_KEY);
    const resolvedLevel = isCEFRLevel(stored) ? stored : 'a1';
    if (isCEFRLevel(stored)) {
      // Syncing from localStorage (unavailable during SSR) on mount, not derived from React state.
      setLevel(stored);
    }
    setPendingWord(readPendingWord(resolvedLevel));
    setLevelRestored(true);
  }, []);

  const handleLevelChange = useCallback((newLevel: CEFRLevel) => {
    setLevel(newLevel);
    localStorage.setItem(LEVEL_STORAGE_KEY, newLevel);
    setPendingWord(readPendingWord(newLevel));
    resetNavigation();
  }, [resetNavigation]);

  // Load mastery stats once the current level's data has finished loading into
  // IndexedDB (avoids reading stats mid-reload while switching levels)
  useEffect(() => {
    if (!initialized) return;

    const loadStats = async () => {
      try {
        const stats = await getMasteryStats();
        setMasteryStats(stats);
      } catch (error) {
        console.error('Failed to load mastery stats:', error);
      }
    };
    loadStats();
  }, [initialized]);

  const updateMasteryStats = useCallback(async () => {
    try {
      const stats = await getMasteryStats();
      setMasteryStats(stats);
    } catch (error) {
      console.error('Failed to update mastery stats:', error);
    }
  }, []);

  useEffect(() => {
    const wordsRemaining = words.length - currentIndex;
    if (wordsRemaining === 1 && !loading) {
      fetchWords();
    }
  }, [currentIndex, words.length, loading, fetchWords]);

  // Remember whichever word is currently on screen but hasn't had an attempt
  // recorded yet (progressSaved). If the app gets killed before it's answered,
  // this word reappears on relaunch instead of a fresh shuffle quietly dropping
  // it — otherwise closing the app would be a free way to skip it. Keyed on
  // vocabularyId/progressSaved (not the whole word) so this doesn't write to
  // localStorage on every keystroke, only when the word or its saved state changes.
  useEffect(() => {
    if (!currentWord) return;

    if (currentWord.progressSaved) {
      localStorage.removeItem(pendingWordKey(level));
    } else {
      localStorage.setItem(pendingWordKey(level), JSON.stringify({
        vocabularyId: currentWord.vocabularyId,
        spanish: currentWord.spanish,
        french: currentWord.french,
        class: currentWord.class,
        category: currentWord.category,
        userAnswer: '',
        isCorrect: null,
        showSolution: false,
        attemptHistory: currentWord.attemptHistory,
        progressSaved: false,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord?.vocabularyId, currentWord?.progressSaved, level]);

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
  }, [currentIndex, setWords]);

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
  }, [currentIndex, setWords]);

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

        await updateMasteryStats();
      } catch (error) {
        console.error('Failed to save progress:', error);
      }
    }

    if (isCorrect) {
      autoAdvance();
    } else {
      triggerShake();
    }
  }, [words, currentIndex, setWords, autoAdvance, triggerShake, updateMasteryStats]);

  const handleToggleSolution = useCallback(async () => {
    const word = words[currentIndex];
    const wasNull = word.isCorrect === null;
    const willShowSolution = !word.showSolution;

    setWords(prevWords => {
      const newWords = [...prevWords];
      const currentWord = newWords[currentIndex];

      newWords[currentIndex] = {
        ...currentWord,
        showSolution: willShowSolution,
        // Mark as incorrect when showing solution (if not already answered)
        isCorrect: willShowSolution && wasNull ? false : currentWord.isCorrect
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

        await updateMasteryStats();
      } catch (error) {
        console.error('Failed to save progress:', error);
      }
    }
  }, [currentIndex, setWords, words, updateMasteryStats]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentWord) return;

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

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
      <TopBar masteryStats={masteryStats} level={level} onLevelChange={handleLevelChange} />
      <main className="flex-1 overflow-y-auto container mx-auto px-4 py-6 sm:py-12">
        {words.length > 0 && currentWord && (
          <div className="relative">
            <div
              className={`transition-all duration-300 ${
                slideDirection === 'left' ? '-translate-x-full opacity-0' : 
                slideDirection === 'right' ? 'translate-x-full opacity-0' : 
                'translate-x-0 opacity-100'
              } ${shakeAnimation ? 'animate-shake' : ''}`}
            >
              <VocabularyCard
                key={currentWord.french}
                word={currentWord}
              />
            </div>
          </div>
        )}
      </main>

      <FixedKeyboard
        hasCurrentWord={!!currentWord}
        showSolution={currentWord?.showSolution || false}
        onKeyPress={handleKeyPress}
        onBackspace={handleBackspace}
        onCheckAnswer={handleCheckAnswer}
        onToggleSolution={handleToggleSolution}
        onNext={goToNext}
      />
    </div>
  );
}
