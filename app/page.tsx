'use client';

import { useEffect } from 'react';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useCardNavigation } from '@/hooks/useCardNavigation';
import { checkAnswerCorrectness } from '@/lib/helpers';
import { VocabularyCard } from './components/VocabularyCard';
import { FixedKeyboard } from './components/FixedKeyboard';

export default function Home() {
  const { words, setWords, loading, fetchWords } = useVocabulary(10);
  const {
    currentIndex,
    slideDirection,
    shakeAnimation,
    goToNext,
    triggerShake,
    autoAdvance,
  } = useCardNavigation(words.length);

  const currentWord = words[currentIndex];

  const correctAnswers = words.filter(w => w.isCorrect === true).length;
  const incorrectAnswers = words.filter(w => w.isCorrect === false).length;
  const totalAnswers = correctAnswers + incorrectAnswers;

  useEffect(() => {
    const wordsRemaining = words.length - currentIndex;
    if (wordsRemaining === 1 && !loading) {
      fetchWords();
    }
  }, [currentIndex, words.length, loading, fetchWords]);

  const handleAnswerChange = (value: string) => {
    setWords(prevWords => {
      const newWords = [...prevWords];
      newWords[currentIndex] = {
        ...newWords[currentIndex],
        userAnswer: value,
        isCorrect: null
      };
      return newWords;
    });
  };

  const handleCheckAnswer = () => {
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

    if (isCorrect) {
      autoAdvance();
    } else {
      triggerShake();
    }
  };

  const handleToggleSolution = () => {
    setWords(prevWords => {
      const newWords = [...prevWords];
      const currentWord = newWords[currentIndex];
      newWords[currentIndex] = {
        ...currentWord,
        showSolution: !currentWord.showSolution,
        // Mark as incorrect when showing solution (if not already answered)
        isCorrect: !currentWord.showSolution && currentWord.isCorrect === null ? false : currentWord.isCorrect
      };
      return newWords;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-6 sm:py-12 max-w-2xl pb-[400px]">
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Trouver la traduction
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="text-green-600 dark:text-green-400 font-semibold">{correctAnswers}</span>
            {' / '}
            <span className="text-red-600 dark:text-red-400 font-semibold">{incorrectAnswers}</span>
            {' sur '}
            <span className="font-semibold">{totalAnswers}</span>
            {' réponses'}
          </p>
        </div>

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
                onAnswerChange={handleAnswerChange}
                onCheckAnswer={handleCheckAnswer}
              />
            </div>
          </div>
        )}

        {words.length === 0 && !loading && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
            <p className="text-lg">Cliquez sur le bouton ci-dessus pour commencer à apprendre!</p>
          </div>
        )}
      </main>

      <FixedKeyboard
        currentWord={currentWord}
        onAnswerChange={handleAnswerChange}
        onCheckAnswer={handleCheckAnswer}
        onToggleSolution={handleToggleSolution}
        onNext={goToNext}
      />
    </div>
  );
}
