import { VocabularyCard } from './VocabularyCard';
import { TranslationResult } from '@/hooks/useVocabularyDB';
import { SlideDirection } from '@/hooks/useCardNavigation';

interface PracticeAreaProps {
  words: TranslationResult[];
  currentWord: TranslationResult | undefined;
  slideDirection: SlideDirection;
  shakeAnimation: boolean;
}

export function PracticeArea({ words, currentWord, slideDirection, shakeAnimation }: PracticeAreaProps) {
  if (words.length === 0 || !currentWord) return null;

  return (
    <div className="relative">
      <div
        className={`transition-all duration-300 ${slideDirection === 'left' ? '-translate-x-full opacity-0' :
          slideDirection === 'right' ? 'translate-x-full opacity-0' :
            'translate-x-0 opacity-100'
          } ${shakeAnimation ? 'animate-shake' : ''}`}
      >
        <VocabularyCard key={currentWord.french} word={currentWord} />
      </div>
    </div>
  );
}
