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
  currentCombo: 0,
  bestCombo: 0,
};

describe('DailyGoal', () => {
  it('renders nothing but a placeholder while unready', () => {
    const { container } = renderWithIntl(<DailyGoal stats={{ ...baseStats, ready: false }} />);
    expect(container.textContent).toBe('');
  });

  it('shows the in-progress count when not completed', () => {
    renderWithIntl(<DailyGoal stats={baseStats} />);
    expect(screen.getByText(/3 sur 10 aujourd'hui/)).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('hides the live combo badge when there is no current streak', () => {
    renderWithIntl(<DailyGoal stats={{ ...baseStats, currentCombo: 0 }} />);
    expect(screen.queryByText(/d'affilée/)).not.toBeInTheDocument();
  });

  it('shows the live combo badge while answering, once a streak is underway', () => {
    renderWithIntl(<DailyGoal stats={{ ...baseStats, currentCombo: 4 }} />);
    expect(screen.getByText("4 d'affilée")).toBeInTheDocument();
    // Today's count/goal must still be visible alongside it.
    expect(screen.getByText(/3 sur 10 aujourd'hui/)).toBeInTheDocument();
  });

  it('replaces the bar with a compact three-stat summary once completed', () => {
    const { container } = renderWithIntl(
      <DailyGoal stats={{ ...baseStats, count: 10, completed: true, currentCombo: 5, bestCombo: 8 }} />
    );
    expect(screen.getByText('10/10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    // The in-progress bar must be gone.
    expect(container.querySelector('.bg-gray-200')).not.toBeInTheDocument();
  });

  it('pops once on the render where justCompleted is true', () => {
    const { container } = renderWithIntl(
      <DailyGoal stats={{ ...baseStats, count: 10, completed: true, justCompleted: true, currentCombo: 5, bestCombo: 8 }} />
    );
    expect(container.querySelector('.animate-pop')).toBeInTheDocument();
  });
});
