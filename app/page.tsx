'use client';

import { useVocabulary } from '@/hooks/useVocabulary';
import { useCardNavigation } from '@/hooks/useCardNavigation';
import { checkAnswerCorrectness } from '@/lib/helpers';
import { VocabularyCard } from './components/VocabularyCard';
import { NavigationButtons } from './components/NavigationButtons';

export default function Home() {
  const { words, setWords, loading, fetchWords } = useVocabulary(10);
  const {
    currentIndex,
    slideDirection,
    shakeAnimation,
    goToNext,
    goToPrevious,
    triggerShake,
    autoAdvance,
    reset,
  } = useCardNavigation(words.length);

  const currentWord = words[currentIndex];

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
    const { isCorrect, showSolution } = checkAnswerCorrectness(
      word.userAnswer || '',
      word.spanish
    );
    
    setWords(prevWords => {
      const newWords = [...prevWords];
      newWords[currentIndex] = {
        ...newWords[currentIndex],
        isCorrect,
        showSolution
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
      newWords[currentIndex] = {
        ...newWords[currentIndex],
        showSolution: !newWords[currentIndex].showSolution
      };
      return newWords;
    });
  };

  const handleNewWords = async () => {
    reset();
    await fetchWords();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-6 sm:py-12 max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Trouver la traduction
          </h1>
          {words.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Mot {currentIndex + 1} sur {words.length}
            </p>
          )}
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
                onToggleSolution={handleToggleSolution}
              />
              <NavigationButtons
                currentIndex={currentIndex}
                totalWords={words.length}
                onPrevious={goToPrevious}
                onNext={goToNext}
                onNewWords={handleNewWords}
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
    </div>
  );
}
