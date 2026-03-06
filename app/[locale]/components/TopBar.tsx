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
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🇪🇸</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                A1
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {masteryStats.mastered}/{masteryStats.total}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <ProgressBar masteryStats={masteryStats} />
          </div>
        </div>
      </div>
    </div>
  );
}
