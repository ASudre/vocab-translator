import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LEARNING_DAILY_GOAL_KEY, REVISION_DAILY_GOAL_KEY, localDayKey } from '@/lib/dailyGoal';

// useDailyGoal caches the current DailyGoalState at module scope (required
// so useSyncExternalStore's getSnapshot can return a stable reference across
// calls). Re-import it fresh for every test so one test's recorded words
// can't leak into the next, mirroring the freshIndexedDB pattern in
// tests/lib/indexedDB.test.ts.
const freshUseDailyGoal = async () => {
  vi.resetModules();
  const mod = await import('@/hooks/useDailyGoal');
  return mod.useDailyGoal;
};

describe('useDailyGoal', () => {
  let useDailyGoal: Awaited<ReturnType<typeof freshUseDailyGoal>>;

  beforeEach(async () => {
    localStorage.clear();
    useDailyGoal = await freshUseDailyGoal();
  });

  it('is ready immediately with 0/10 when nothing is stored', () => {
    const { result } = renderHook(() => useDailyGoal());
    expect(result.current.ready).toBe(true);
    expect(result.current.count).toBe(0);
    expect(result.current.goal).toBe(10);
    expect(result.current.completed).toBe(false);
  });

  it('restores an existing count for today', () => {
    const today = localDayKey(new Date());
    localStorage.setItem(LEARNING_DAILY_GOAL_KEY, JSON.stringify({ day: today, ids: [1, 2, 3] }));

    const { result } = renderHook(() => useDailyGoal());
    expect(result.current.count).toBe(3);
  });

  it('does not restore a count left over from a previous day', () => {
    localStorage.setItem(LEARNING_DAILY_GOAL_KEY, JSON.stringify({ day: '2000-01-01', ids: [1, 2, 3] }));

    const { result } = renderHook(() => useDailyGoal());
    expect(result.current.count).toBe(0);
  });

  it('recordCorrect increments the count and persists it', () => {
    const { result } = renderHook(() => useDailyGoal());

    act(() => result.current.recordCorrect(42));
    expect(result.current.count).toBe(1);

    const today = localDayKey(new Date());
    expect(JSON.parse(localStorage.getItem(LEARNING_DAILY_GOAL_KEY)!)).toEqual({ day: today, ids: [42] });
  });

  it('recordCorrect does not double-count the same word', () => {
    const { result } = renderHook(() => useDailyGoal());

    act(() => result.current.recordCorrect(42));
    act(() => result.current.recordCorrect(42));
    expect(result.current.count).toBe(1);
  });

  it('marks completed once the count reaches the goal', () => {
    const { result } = renderHook(() => useDailyGoal());

    act(() => {
      for (let id = 0; id < 10; id++) result.current.recordCorrect(id);
    });

    expect(result.current.count).toBe(10);
    expect(result.current.completed).toBe(true);
  });

  it('keeps a different storage key fully independent (learning vs. revision)', () => {
    const learning = renderHook(() => useDailyGoal(LEARNING_DAILY_GOAL_KEY));
    const revision = renderHook(() => useDailyGoal(REVISION_DAILY_GOAL_KEY));

    act(() => learning.result.current.recordCorrect(1));

    expect(learning.result.current.count).toBe(1);
    expect(revision.result.current.count).toBe(0);
  });

  it('shares state across multiple mounted instances', () => {
    const a = renderHook(() => useDailyGoal());
    const b = renderHook(() => useDailyGoal());

    act(() => a.result.current.recordCorrect(1));

    expect(a.result.current.count).toBe(1);
    expect(b.result.current.count).toBe(1);
  });

  describe('justCompleted', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('flips true exactly on the transition into completed, then clears after 1s', () => {
      const { result } = renderHook(() => useDailyGoal());

      act(() => {
        for (let id = 0; id < 9; id++) result.current.recordCorrect(id);
      });
      expect(result.current.justCompleted).toBe(false);

      act(() => result.current.recordCorrect(9));
      expect(result.current.justCompleted).toBe(true);

      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.justCompleted).toBe(false);
    });

    it('does not re-trigger for words recorded after completion', () => {
      const { result } = renderHook(() => useDailyGoal());

      act(() => {
        for (let id = 0; id < 10; id++) result.current.recordCorrect(id);
      });
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.justCompleted).toBe(false);

      act(() => result.current.recordCorrect(10));
      expect(result.current.justCompleted).toBe(false);
    });
  });

  it('rolls over to a fresh count when the real day changes and the tab regains focus', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16, 23, 0, 0));

    const { result } = renderHook(() => useDailyGoal());
    act(() => result.current.recordCorrect(1));
    expect(result.current.count).toBe(1);

    // Tab stays open across local midnight.
    vi.setSystemTime(new Date(2026, 8, 17, 0, 30, 0));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current.count).toBe(0);

    vi.useRealTimers();
  });
});
