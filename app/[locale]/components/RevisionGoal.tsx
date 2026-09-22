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
}

export const RevisionGoal = memo(function RevisionGoal({ stats }: RevisionGoalProps) {
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
    />
  );
});
