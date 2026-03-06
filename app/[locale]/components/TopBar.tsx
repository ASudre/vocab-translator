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
    <div className="w-full border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto">
        <div className="flex items-center justify-start rounded-xl p-4">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-2">
            <span className="text-lg">🇪🇸</span>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              A1
            </span>
          </div>
          <div className="flex-1 pl-4">
            <ProgressBar masteryStats={masteryStats} />
          </div>
        </div>
      </div>
    </div>
  );
}
