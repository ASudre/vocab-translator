import { memo } from 'react';
import { SpanishKeyboard } from './SpanishKeyboard';

interface FixedKeyboardProps {
  hasCurrentWord: boolean;
  showSolution: boolean;
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onCheckAnswer: () => void;
  onToggleSolution: () => void;
  onNext: () => void;
}

export const FixedKeyboard = memo(function FixedKeyboard({
  hasCurrentWord,
  showSolution,
  onKeyPress,
  onBackspace,
  onCheckAnswer,
  onToggleSolution,
  onNext,
}: FixedKeyboardProps) {
  if (!hasCurrentWord) return null;

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
          showSolution={showSolution}
        />
      </div>
    </div>
  );
});
