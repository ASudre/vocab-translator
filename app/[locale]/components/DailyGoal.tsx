import { memo } from 'react';
import { useTranslations } from 'next-intl';

interface DailyGoalProps {
  dailyGoal: {
    ready: boolean;
    count: number;
    goal: number;
    completed: boolean;
    justCompleted: boolean;
  };
}

export const DailyGoal = memo(function DailyGoal({ dailyGoal }: DailyGoalProps) {
  const t = useTranslations('DailyGoal');
  const { ready, count, goal, completed, justCompleted } = dailyGoal;

  // Reserve the same footprint while unready so nothing shifts once
  // localStorage has been read after mount (static export has no
  // localStorage at prerender, so this can't be resolved before mount).
  if (!ready) {
    return <div className="h-[52px]" aria-hidden="true" />;
  }

  const percentage = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;
  const label = completed ? t('completed') : t('progress', { count, goal });

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 ${justCompleted ? 'animate-pop' : ''}`}
      title={t('ariaLabel', { count, goal })}
      aria-label={t('ariaLabel', { count, goal })}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <span aria-hidden="true">🎯</span> {label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              completed
                ? 'bg-gradient-to-r from-green-400 to-green-600 dark:from-green-500 dark:to-green-700'
                : 'bg-gradient-to-r from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-700'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {completed ? (
          <span className="text-sm font-bold text-green-600 dark:text-green-400">✓</span>
        ) : (
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{count}/{goal}</span>
        )}
      </div>
    </div>
  );
});
