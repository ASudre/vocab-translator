import { SpanishKeyboard } from './SpanishKeyboard';
import { TranslationResult } from '@/hooks/useVocabulary';

interface FixedKeyboardProps {
  currentWord: TranslationResult | undefined;
  onAnswerChange: (value: string) => void;
  onCheckAnswer: () => void;
}

export function FixedKeyboard({
  currentWord,
  onAnswerChange,
  onCheckAnswer,
}: FixedKeyboardProps) {
  if (!currentWord) return null;

  const handleKeyPress = (key: string) => {
    const currentValue = currentWord.userAnswer || '';
    onAnswerChange(currentValue + key);
  };

  const handleBackspace = () => {
    const currentValue = currentWord.userAnswer || '';
    onAnswerChange(currentValue.slice(0, -1));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-blue-50 to-transparent dark:from-gray-900 dark:to-transparent pt-4">
      <div className="container mx-auto max-w-2xl">
        <SpanishKeyboard
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onEnter={onCheckAnswer}
        />
      </div>
    </div>
  );
}
