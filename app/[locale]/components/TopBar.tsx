import { CEFRLevel } from '@/hooks/useVocabularyDB';
import { ProgressBar } from './ProgressBar';
import { LevelSelector } from './LevelSelector';

interface TopBarProps {
  masteryStats: {
    total: number;
    mastered: number;
    percentage: number;
  };
  level: CEFRLevel;
  onLevelChange: (level: CEFRLevel) => void;
}

export function TopBar({ masteryStats, level, onLevelChange }: TopBarProps) {
  return (
    <div className="w-full border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto">
        <div className="flex items-center justify-start rounded-xl p-4">
          <LevelSelector level={level} onChange={onLevelChange} />
          <div className="flex-1 pl-4">
            <ProgressBar masteryStats={masteryStats} />
          </div>
        </div>
      </div>
    </div>
  );
}
