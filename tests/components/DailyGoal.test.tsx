import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../helpers/renderWithIntl';
import { DailyGoal } from '@/app/[locale]/components/DailyGoal';

const baseStats = {
  ready: true,
  count: 3,
  goal: 10,
  completed: false,
  justCompleted: false,
  masteredToday: 0,
};

describe('DailyGoal', () => {
  it('renders nothing but a placeholder while unready', () => {
    const { container } = renderWithIntl(<DailyGoal stats={{ ...baseStats, ready: false }} />);
    expect(container.textContent).toBe('');
  });

  it('shows the in-progress count and mastered-today badge when not completed', () => {
    renderWithIntl(<DailyGoal stats={{ ...baseStats, masteredToday: 2 }} />);
    expect(screen.getByText(/3 sur 10 aujourd'hui/)).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('replaces the bar with a compact two-stat summary once completed', () => {
    const { container } = renderWithIntl(
      <DailyGoal stats={{ ...baseStats, count: 10, completed: true, masteredToday: 4 }} />
    );
    expect(screen.getByText('10/10')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    // The in-progress bar must be gone.
    expect(container.querySelector('.bg-gray-200')).not.toBeInTheDocument();
  });

  it('pops once on the render where justCompleted is true', () => {
    const { container } = renderWithIntl(
      <DailyGoal stats={{ ...baseStats, count: 10, completed: true, justCompleted: true, masteredToday: 4 }} />
    );
    expect(container.querySelector('.animate-pop')).toBeInTheDocument();
  });
});
