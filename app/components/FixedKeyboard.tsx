import { SpanishKeyboard } from './SpanishKeyboard';
import { TranslationResult } from '@/hooks/useVocabulary';

interface FixedKeyboardProps {
  currentWord: TranslationResult | undefined;
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onCheckAnswer: () => void;
  onToggleSolution: () => void;
  onNext: () => void;
}

export function FixedKeyboard({
  currentWord,
  onKeyPress,
  onBackspace,
  onCheckAnswer,
  onToggleSolution,
  onNext,
}: FixedKeyboardProps) {
  if (!currentWord) return null;

  return (
    <div 
      className="flex-shrink-0 bg-gradient-to-t from-blue-50 to-transparent dark:from-gray-900 dark:to-transparent touch-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
    >
      <div className="container mx-auto max-w-2xl">
        <SpanishKeyboard
          onKeyPress={onKeyPress}
          onBackspace={onBackspace}
          onEnter={onCheckAnswer}
          onToggleSolution={onToggleSolution}
          onNext={onNext}
          showSolution={currentWord?.showSolution || false}
        />
      </div>
    </div>
  );
}
