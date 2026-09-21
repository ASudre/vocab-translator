import { memo } from 'react';
import { useTranslations } from 'next-intl';

interface DailyGoalProps {
  stats: {
    ready: boolean;
    count: number;
    goal: number;
    completed: boolean;
    justCompleted: boolean;
    currentCombo: number;
    bestCombo: number;
  };
}

export const DailyGoal = memo(function DailyGoal({ stats }: DailyGoalProps) {
  const t = useTranslations('DailyGoal');
  const { ready, count, goal, completed, justCompleted, currentCombo, bestCombo } = stats;

  // Reserve the same footprint while unready so nothing shifts once
  // localStorage/IndexedDB have been read after mount (static export has
  // neither at prerender, so this can't be resolved before mount).
  if (!ready) {
    return <div className="h-[52px]" aria-hidden="true" />;
  }

  const cardClasses = `bg-white dark:bg-gray-800 rounded-xl shadow-md p-2 sm:p-3 ${justCompleted ? 'animate-pop' : ''}`;

  if (completed) {
    return (
      <div
        className={cardClasses}
        title={t('ariaLabelCompleted', { count, goal, currentCombo, bestCombo })}
        aria-label={t('ariaLabelCompleted', { count, goal, currentCombo, bestCombo })}
      >
        <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <span aria-hidden="true">✅</span> {t('todayLabel', { count, goal })}
          </span>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <span aria-hidden="true">🔥</span> {t('comboLabel', { count: currentCombo })}
          </span>
          <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
            <span aria-hidden="true">🏆</span> {t('bestComboLabel', { count: bestCombo })}
          </span>
        </div>
      </div>
    );
  }

  const percentage = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;
  const hasCombo = currentCombo > 0;
  const ariaLabel = hasCombo
    ? `${t('ariaLabel', { count, goal })} ${t('comboLabel', { count: currentCombo })}`
    : t('ariaLabel', { count, goal });

  return (
    <div className={cardClasses} title={ariaLabel} aria-label={ariaLabel}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <span aria-hidden="true">🎯</span> {t('progress', { count, goal })}
        </span>
        {hasCombo && (
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span aria-hidden="true">🔥</span> {t('comboLabel', { count: currentCombo })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-700"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{count}/{goal}</span>
      </div>
    </div>
  );
});
