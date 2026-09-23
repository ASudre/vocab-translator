import { memo } from 'react';
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

export const TopBar = memo(function TopBar({ masteryStats, level, onLevelChange }: TopBarProps) {
  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-start rounded-xl gap-2">
        <LevelSelector level={level} onChange={onLevelChange} />
        <div className="flex-1">
          <ProgressBar masteryStats={masteryStats} />
        </div>
      </div>
    </div>
  );
});
