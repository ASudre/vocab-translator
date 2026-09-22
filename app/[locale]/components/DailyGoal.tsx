import { memo } from 'react';
import { useTranslations } from 'next-intl';

const MasteryDots = () => (
  <span className="flex gap-0.5" aria-hidden="true">
    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
  </span>
);

interface DailyGoalProps {
  stats: {
    ready: boolean;
    count: number;
    goal: number;
    completed: boolean;
    justCompleted: boolean;
    masteredToday: number;
  };
}

export const DailyGoal = memo(function DailyGoal({ stats }: DailyGoalProps) {
  const t = useTranslations('DailyGoal');
  const { ready, count, goal, completed, justCompleted, masteredToday } = stats;

  // Reserve the same footprint while unready so nothing shifts once
  // localStorage/IndexedDB have been read after mount (static export has
  // neither at prerender, so this can't be resolved before mount).
  if (!ready) {
    return <div className="h-[52px]" aria-hidden="true" />;
  }

  const cardClasses = `bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 ${justCompleted ? 'animate-pop' : ''}`;
  // Correct answers keep accumulating past the goal (e.g. 11/10) once it's
  // met, but the badge should read as "goal reached", not overflow past 100%.
  const displayCount = Math.min(count, goal);
  const percentage = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;
  const ariaLabel = completed
    ? t('ariaLabelCompleted', { count: displayCount, goal, masteredToday })
    : t('ariaLabel', { count: displayCount, goal, masteredToday });

  return (
    <div className={cardClasses} title={ariaLabel} aria-label={ariaLabel}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
        {t('heading')}
      </div>
      <div className="flex items-center justify-between text-xs font-bold">
        <span
          className={`flex items-center gap-1 ${completed ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400 font-normal'}`}
        >
          <span aria-hidden="true">🎯</span> {displayCount}/{goal}
        </span>
        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
          {masteredToday} <MasteryDots />
        </span>
      </div>
      {!completed && (
        <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-700"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
});
