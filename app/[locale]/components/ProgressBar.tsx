import { useTranslations } from "next-intl";

interface ProgressBarProps {
  masteryStats: {
    total: number;
    mastered: number;
    percentage: number;
  };
}

export function ProgressBar({ masteryStats }: ProgressBarProps) {
  const t = useTranslations('ProgressBar');
  return (<>
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {masteryStats.mastered} / {masteryStats.total} {t('unlocked')}
      </span>
      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
        {masteryStats.percentage}%
      </span>
    </div>
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-green-400 to-green-600 dark:from-green-500 dark:to-green-700 transition-all duration-500 ease-out rounded-full"
        style={{ width: `${masteryStats.percentage}%` }}
      />
    </div>
  </>
  );
}
