import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { TranslationResult } from '@/hooks/useVocabularyDB';

interface VocabularyCardProps {
  word: TranslationResult;
}

export function VocabularyCard({
  word,
}: VocabularyCardProps) {
  const t = useTranslations('VocabularyCard');
  const tClass = useTranslations('WordClass');
  const inputRef = useRef<HTMLInputElement>(null);

  const renderAttemptDots = () => {
    const history = word.attemptHistory || [];
    const dots = [];
    
    for (let i = 0; i < 3; i++) {
      const attempt = history[i];
      let dotColor = 'bg-gray-300 dark:bg-gray-600';
      
      if (attempt === true) {
        dotColor = 'bg-green-500';
      } else if (attempt === false) {
        dotColor = 'bg-red-500';
      }
      
      dots.push(
        <div
          key={i}
          className={`w-3 h-3 rounded-full ${dotColor} transition-colors`}
          title={attempt === true ? t('attemptSuccess') : attempt === false ? t('attemptFailed') : t('attemptNotTried')}
        />
      );
    }
    
    return dots;
  };

  return (
    <div className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 md:p-10 transition-all ${
        word.isCorrect === true
          ? 'ring-4 ring-green-500 ring-offset-0'
          : word.isCorrect === false && !word.showSolution
          ? 'ring-4 ring-red-500 ring-offset-0'
          : ''
      }`}>
        <span className="absolute top-4 right-4 px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
          {tClass(word.class as 'adjective' | 'adverb' | 'interjection' | 'noun' | 'number' | 'phrase' | 'preposition' | 'pronoun' | 'verb')}
        </span>
        
        <div className="text-center mb-8">
          <div className="flex justify-center gap-2 mb-3">
            {renderAttemptDots()}
          </div>
          <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            {word.french}
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            {t('questionPrompt')}
          </p>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={word.showSolution ? word.spanish : (word.userAnswer || '')}
          readOnly
          placeholder={t('inputPlaceholder')}
          disabled={word.isCorrect === true || word.showSolution}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          inputMode="none"
          className={`w-full px-4 py-4 text-lg text-center border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed caret-transparent ${
            word.showSolution ? 'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 font-bold' : 'border-gray-300 dark:border-gray-600'
          }`}
        />

        {word.isCorrect === true && (
          <div className="flex items-center justify-center gap-3 text-green-600 dark:text-green-400 font-bold text-xl animate-bounce mt-4">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {t('correctMessage')}
          </div>
        )}

        {word.isCorrect === false && !word.showSolution && (
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-center gap-3 text-red-600 dark:text-red-400 font-bold text-xl">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {t('retryMessage')}
            </div>
            <div className="text-center text-gray-600 dark:text-gray-400">
              {t('hintPrefix')} <span className="font-bold text-indigo-600 dark:text-indigo-400">&quot;{word.spanish[0]}&quot;</span>
            </div>
          </div>
        )}
      </div>
  );
}
