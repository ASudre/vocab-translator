import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { GoalCard } from './GoalCard';

interface RevisionGoalProps {
  stats: {
    ready: boolean;
    count: number;
    goal: number;
    completed: boolean;
    justCompleted: boolean;
  };
  /** Words sent back to learning by a revision miss today - see computeDemotedToday. */
  demotedToday: number;
}

export const RevisionGoal = memo(function RevisionGoal({ stats, demotedToday }: RevisionGoalProps) {
  const t = useTranslations('RevisionGoal');
  const { ready, count, goal, completed, justCompleted } = stats;

  const ariaLabel = completed
    ? t('ariaLabelCompleted', { count, goal })
    : t('ariaLabel', { count, goal });

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
        demotedToday > 0 ? (
          <span
            className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
            title={t('backToLearningToday', { count: demotedToday })}
          >
            {demotedToday} <span aria-hidden="true">↩</span>
          </span>
        ) : undefined
      }
    />
  );
});
