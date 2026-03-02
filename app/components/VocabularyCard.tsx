import { useEffect, useRef } from 'react';
import { TranslationResult } from '@/hooks/useVocabulary';

interface VocabularyCardProps {
  word: TranslationResult;
  onAnswerChange: (value: string) => void;
  onCheckAnswer: () => void;
  onToggleSolution: () => void;
}

export function VocabularyCard({
  word,
  onAnswerChange,
  onCheckAnswer,
  onToggleSolution,
}: VocabularyCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Keep focus on iOS Safari by maintaining the same input element
    if (inputRef.current && !word.isCorrect) {
      // Small delay to ensure DOM is ready after state update
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [word.french, word.isCorrect]);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 md:p-10 transition-all ${
      word.isCorrect === true
        ? 'ring-4 ring-green-500 ring-offset-0'
        : word.isCorrect === false
        ? 'ring-4 ring-red-500 ring-offset-0'
        : ''
    }`}>
      <div className="text-center mb-8">
        <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
          {word.french}
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Quelle est la traduction en espagnol ?
        </p>
      </div>

      <div className="space-y-4">
        <input
          ref={inputRef}
          type="text"
          value={word.userAnswer || ''}
          onChange={(e) => onAnswerChange(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              onCheckAnswer();
            }
          }}
          placeholder="Écris la traduction en espagnol..."
          disabled={word.isCorrect === true}
          autoFocus
          className="w-full px-4 py-4 text-lg text-center border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed"
        />

        <div className="flex gap-3">
          <button
            onClick={onCheckAnswer}
            disabled={!word.userAnswer || word.isCorrect === true}
            className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold text-lg rounded-xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
          >
            Vérifier
          </button>
          <button
            onClick={onToggleSolution}
            className="px-6 py-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
          >
            {word.showSolution ? '🙈' : '💡'}
          </button>
        </div>

        {word.isCorrect === true && (
          <div className="flex items-center justify-center gap-3 text-green-600 dark:text-green-400 font-bold text-xl animate-bounce">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Correct ! 🎉
          </div>
        )}

        {word.isCorrect === false && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3 text-red-600 dark:text-red-400 font-bold text-xl">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              Réessaye ! 💪
            </div>
            <div className="text-center text-gray-600 dark:text-gray-400">
              Indice: Commence par <span className="font-bold text-indigo-600 dark:text-indigo-400">&quot;{word.spanish[0]}&quot;</span>
            </div>
          </div>
        )}

        {word.showSolution && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800 text-center">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              Solution:
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {word.spanish}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
