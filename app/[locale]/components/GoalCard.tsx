import { memo, ReactNode } from 'react';

interface GoalCardProps {
  ready: boolean;
  heading: string;
  count: number;
  goal: number;
  completed: boolean;
  justCompleted: boolean;
  ariaLabel: string;
  /** Optional badge shown opposite the count (e.g. DailyGoal's mastered-today dots). */
  right?: ReactNode;
}

export const GoalCard = memo(function GoalCard({
  ready,
  heading,
  count,
  goal,
  completed,
  justCompleted,
  ariaLabel,
  right,
}: GoalCardProps) {
  // Reserve the same footprint while unready so nothing shifts once
  // localStorage has been read after mount (static export has none at
  // prerender, so this can't be resolved before mount).
  if (!ready) {
    return <div className="h-[52px]" aria-hidden="true" />;
  }

  const cardClasses = `bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 ${justCompleted ? 'animate-pop' : ''}`;
  const percentage = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;

  return (
    <div className={cardClasses} title={ariaLabel} aria-label={ariaLabel}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 truncate">
            {heading}
          </span>
          <span
            className={`flex items-center gap-1 text-xs font-bold ${completed ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400 font-normal'}`}
          >
            {count}/{goal} <span aria-hidden="true">🎯</span>
          </span>
        </div>
        {right}
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
