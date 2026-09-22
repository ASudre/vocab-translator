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

  it("labels the card as today's stats", () => {
    renderWithIntl(<DailyGoal stats={baseStats} />);
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
  });

  it('shows the in-progress count and mastered-today badge when not completed', () => {
    const { container } = renderWithIntl(<DailyGoal stats={{ ...baseStats, masteredToday: 2 }} />);
    expect(container.textContent).toContain('3/10');
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(container.querySelector('.bg-gray-200')).toBeInTheDocument();
  });

  it('keeps counting words found past the goal instead of capping at it', () => {
    const { container } = renderWithIntl(
      <DailyGoal stats={{ ...baseStats, count: 11, completed: true, masteredToday: 4 }} />
    );
    expect(container.textContent).toContain('11/10');
  });

  it('replaces the bar with a compact two-stat summary once completed', () => {
    const { container } = renderWithIntl(
      <DailyGoal stats={{ ...baseStats, count: 10, completed: true, masteredToday: 4 }} />
    );
    expect(container.textContent).toContain('10/10');
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
