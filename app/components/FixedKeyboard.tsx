import { useCallback } from 'react';
import { SpanishKeyboard } from './SpanishKeyboard';
import { TranslationResult } from '@/hooks/useVocabulary';

interface FixedKeyboardProps {
  currentWord: TranslationResult | undefined;
  onAnswerChange: (value: string) => void;
  onCheckAnswer: () => void;
  onToggleSolution: () => void;
  onNext: () => void;
}

export function FixedKeyboard({
  currentWord,
  onAnswerChange,
  onCheckAnswer,
  onToggleSolution,
  onNext,
}: FixedKeyboardProps) {
  const handleKeyPress = useCallback((key: string) => {
    if (!currentWord) return;
    const currentValue = currentWord.userAnswer || '';
    onAnswerChange(currentValue + key);
  }, [currentWord, onAnswerChange]);

  const handleBackspace = useCallback(() => {
    if (!currentWord) return;
    const currentValue = currentWord.userAnswer || '';
    onAnswerChange(currentValue.slice(0, -1));
  }, [currentWord, onAnswerChange]);

  if (!currentWord) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-blue-50 to-transparent dark:from-gray-900 dark:to-transparent pt-4"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
    >
      <div className="container mx-auto max-w-2xl">
        <SpanishKeyboard
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onEnter={onCheckAnswer}
          onToggleSolution={onToggleSolution}
          onNext={onNext}
          showSolution={currentWord?.showSolution || false}
        />
      </div>
    </div>
  );
}
