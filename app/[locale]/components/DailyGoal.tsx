import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { GoalCard } from './GoalCard';
import { MasteryDots } from './MasteryDots';

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

  const ariaLabel = completed
    ? t('ariaLabelCompleted', { count, goal, masteredToday })
    : t('ariaLabel', { count, goal, masteredToday });

  return (
    <GoalCard
      ready={ready}
      heading={t('heading')}
      count={count}
      goal={goal}
      completed={completed}
      justCompleted={justCompleted}
      ariaLabel={ariaLabel}
      right={
        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
          {masteredToday} <MasteryDots />
        </span>
      }
    />
  );
});
