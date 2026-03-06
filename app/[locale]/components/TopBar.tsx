import { ProgressBar } from './ProgressBar';

interface TopBarProps {
  masteryStats: {
    total: number;
    mastered: number;
    percentage: number;
  };
}

export function TopBar({ masteryStats }: TopBarProps) {
  return (
    <div className="w-full p-2">
      <div className="container mx-auto">
        <div className="flex items-center justify-between rounded-xl shadow-lg p-3 gap-6">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-2">
            <span className="text-lg">🇪🇸</span>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              A1
            </span>
          </div>
          
          <ProgressBar masteryStats={masteryStats} />
        </div>
      </div>
    </div>
  );
}
