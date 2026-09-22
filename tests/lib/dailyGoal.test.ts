import { describe, it, expect, beforeEach } from 'vitest';
import {
  DAILY_GOAL,
  LEARNING_DAILY_GOAL_KEY,
  REVISION_DAILY_GOAL_KEY,
  localDayKey,
  readDailyGoal,
  writeDailyGoal,
  recordCorrectWord,
  dailyGoalProgress,
  DailyGoalState,
} from '@/lib/dailyGoal';

describe('localDayKey', () => {
  it('uses local date components, not UTC', () => {
    // Late evening local time: a naive toISOString()-based key would roll
    // this into the next UTC day in any timezone east of UTC.
    const lateEvening = new Date(2026, 8, 16, 23, 30, 0); // month is 0-indexed: September
    expect(localDayKey(lateEvening)).toBe('2026-09-16');
  });

  it('pads single-digit months and days', () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('readDailyGoal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a fresh empty state when nothing is stored', () => {
    expect(readDailyGoal(LEARNING_DAILY_GOAL_KEY, '2026-09-16')).toEqual({ day: '2026-09-16', ids: [] });
  });

  it('restores a stored state for the same day', () => {
    const state: DailyGoalState = { day: '2026-09-16', ids: [1, 2, 3] };
    localStorage.setItem(LEARNING_DAILY_GOAL_KEY, JSON.stringify(state));
    expect(readDailyGoal(LEARNING_DAILY_GOAL_KEY, '2026-09-16')).toEqual(state);
  });

  it('resets to empty when the stored day differs from today', () => {
    const state: DailyGoalState = { day: '2026-09-15', ids: [1, 2, 3] };
    localStorage.setItem(LEARNING_DAILY_GOAL_KEY, JSON.stringify(state));
    expect(readDailyGoal(LEARNING_DAILY_GOAL_KEY, '2026-09-16')).toEqual({ day: '2026-09-16', ids: [] });
  });

  it('self-heals and clears the key on malformed JSON', () => {
    localStorage.setItem(LEARNING_DAILY_GOAL_KEY, '{not valid json');
    expect(readDailyGoal(LEARNING_DAILY_GOAL_KEY, '2026-09-16')).toEqual({ day: '2026-09-16', ids: [] });
    expect(localStorage.getItem(LEARNING_DAILY_GOAL_KEY)).toBeNull();
  });

  it('returns a fresh state for well-formed JSON with the wrong shape', () => {
    localStorage.setItem(LEARNING_DAILY_GOAL_KEY, JSON.stringify({ day: '2026-09-16', ids: 'nope' }));
    expect(readDailyGoal(LEARNING_DAILY_GOAL_KEY, '2026-09-16')).toEqual({ day: '2026-09-16', ids: [] });
  });

  it('returns a fresh state when ids contains non-numbers', () => {
    localStorage.setItem(LEARNING_DAILY_GOAL_KEY, JSON.stringify({ day: '2026-09-16', ids: [1, 'two'] }));
    expect(readDailyGoal(LEARNING_DAILY_GOAL_KEY, '2026-09-16')).toEqual({ day: '2026-09-16', ids: [] });
  });
});

describe('storage key isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps the learning and revision goals in fully independent storage', () => {
    writeDailyGoal(LEARNING_DAILY_GOAL_KEY, { day: '2026-09-16', ids: [1, 2] });
    writeDailyGoal(REVISION_DAILY_GOAL_KEY, { day: '2026-09-16', ids: [9] });

    expect(readDailyGoal(LEARNING_DAILY_GOAL_KEY, '2026-09-16').ids).toEqual([1, 2]);
    expect(readDailyGoal(REVISION_DAILY_GOAL_KEY, '2026-09-16').ids).toEqual([9]);
  });
});

describe('writeDailyGoal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists state that readDailyGoal can read back', () => {
    const state: DailyGoalState = { day: '2026-09-16', ids: [1, 2] };
    writeDailyGoal(LEARNING_DAILY_GOAL_KEY, state);
    expect(readDailyGoal(LEARNING_DAILY_GOAL_KEY, '2026-09-16')).toEqual(state);
  });

  it('does not throw when localStorage.setItem throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => writeDailyGoal(LEARNING_DAILY_GOAL_KEY, { day: '2026-09-16', ids: [1] })).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe('recordCorrectWord', () => {
  it('appends a new id', () => {
    const state: DailyGoalState = { day: '2026-09-16', ids: [1] };
    const result = recordCorrectWord(state, 2);
    expect(result.ids).toEqual([1, 2]);
  });

  it('returns the identical reference for a duplicate id', () => {
    const state: DailyGoalState = { day: '2026-09-16', ids: [1, 2] };
    const result = recordCorrectWord(state, 2);
    expect(result).toBe(state);
  });
});

describe('dailyGoalProgress', () => {
  it('reports count, goal, and percentage', () => {
    const state: DailyGoalState = { day: '2026-09-16', ids: [1, 2, 3] };
    expect(dailyGoalProgress(state, 10)).toEqual({ count: 3, goal: 10, completed: false, percentage: 30 });
  });

  it('is not completed below the goal', () => {
    const state: DailyGoalState = { day: '2026-09-16', ids: new Array(9).fill(0).map((_, i) => i) };
    expect(dailyGoalProgress(state, DAILY_GOAL).completed).toBe(false);
  });

  it('is completed exactly at the goal', () => {
    const state: DailyGoalState = { day: '2026-09-16', ids: new Array(10).fill(0).map((_, i) => i) };
    expect(dailyGoalProgress(state, DAILY_GOAL).completed).toBe(true);
  });

  it('stays completed past the goal, with percentage capped at 100', () => {
    const state: DailyGoalState = { day: '2026-09-16', ids: new Array(15).fill(0).map((_, i) => i) };
    const result = dailyGoalProgress(state, DAILY_GOAL);
    expect(result.completed).toBe(true);
    expect(result.percentage).toBe(100);
  });
});
