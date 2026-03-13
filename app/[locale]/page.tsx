'use client';

import { useEffect, useCallback, useState } from 'react';
import { useVocabularyDB } from '@/hooks/useVocabularyDB';
import { useCardNavigation } from '@/hooks/useCardNavigation';
import { checkAnswerCorrectness } from '@/lib/helpers';
import { saveUserProgress, getMasteryStats, getUserProgress } from '@/lib/indexedDB';
import { VocabularyCard } from './components/VocabularyCard';
import { FixedKeyboard } from './components/FixedKeyboard';
import { TopBar } from './components/TopBar';
import { RewardOverlay } from './components/RewardOverlay';

type RewardKind = 'mastered' | 'level';

const LEVEL_COMPLETED_KEY = 'palabras-level-a1-completed';

export default function Home() {
  const { words, setWords, loading, fetchWords } = useVocabularyDB(10);
  const [masteryStats, setMasteryStats] = useState({ total: 0, mastered: 0, percentage: 0 });
  const [reward, setReward] = useState<RewardKind | null>(null);
  const {
    currentIndex,
    slideDirection,
    shakeAnimation,
    goToNext,
    triggerShake,
    autoAdvance,
  } = useCardNavigation(words.length);
  
  const currentWord = words[currentIndex];

  // Load mastery stats on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await getMasteryStats();
        setMasteryStats(stats);
      } catch (error) {
        console.error('Failed to load mastery stats:', error);
      }
    };
    loadStats();
  }, []);

  const updateMasteryStats = useCallback(async () => {
    try {
      const stats = await getMasteryStats();
      setMasteryStats(stats);
      return stats;
    } catch (error) {
      console.error('Failed to update mastery stats:', error);
    }
    return null;
  }, []);

  useEffect(() => {
    const wordsRemaining = words.length - currentIndex;
    if (wordsRemaining === 1 && !loading) {
      fetchWords();
    }
  }, [currentIndex, words.length, loading, fetchWords]);

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
        const previousProgress = await getUserProgress(word.vocabularyId);

        await saveUserProgress(word.vocabularyId, isCorrect);
        console.log(`Progress saved for word ${word.vocabularyId}: ${isCorrect ? 'correct' : 'incorrect'}`);

        const nextProgress = await getUserProgress(word.vocabularyId);
        const justMastered =
          previousProgress?.masteryLevel !== 3 &&
          nextProgress?.masteryLevel === 3;

        if (justMastered) {
          setReward('mastered');
        }
        
        setWords(prevWords => {
          const newWords = [...prevWords];
          const currentAttemptHistory = newWords[currentIndex].attemptHistory || [];
          const newAttemptHistory = [...currentAttemptHistory, isCorrect].slice(-3);
          
          newWords[currentIndex] = {
            ...newWords[currentIndex],
            progressSaved: true,
            attemptHistory: newAttemptHistory
          };
          return newWords;
        });

        const stats = await updateMasteryStats();
        if (stats && stats.total > 0 && stats.mastered === stats.total) {
          const alreadyCompleted = localStorage.getItem(LEVEL_COMPLETED_KEY) === '1';

          if (!alreadyCompleted) {
            localStorage.setItem(LEVEL_COMPLETED_KEY, '1');
            setReward('level');
          }
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
          const currentAttemptHistory = newWords[currentIndex].attemptHistory || [];
          const newAttemptHistory = [...currentAttemptHistory, false].slice(-3);
          
          newWords[currentIndex] = {
            ...newWords[currentIndex],
            progressSaved: true,
            attemptHistory: newAttemptHistory
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
      <TopBar masteryStats={masteryStats} />
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
        currentWord={currentWord}
        onKeyPress={handleKeyPress}
        onBackspace={handleBackspace}
        onCheckAnswer={handleCheckAnswer}
        onToggleSolution={handleToggleSolution}
        onNext={goToNext}
      />

      {reward && (
        <RewardOverlay
          kind={reward}
          onDone={() => {
            setReward(null);
          }}
        />
      )}
    </div>
  );
}
