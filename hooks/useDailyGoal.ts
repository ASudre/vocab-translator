import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import {
  DAILY_GOAL,
  DailyGoalState,
  localDayKey,
  readDailyGoal,
  writeDailyGoal,
  recordCorrectWord,
  dailyGoalProgress,
} from '@/lib/dailyGoal';

/**
 * Empty sentinel used as both the pre-hydration snapshot (this app is
 * statically exported and force-static, so localStorage doesn't exist at
 * prerender) and the initial in-memory cache. An empty `day` means "not
 * hydrated yet"; useDailyGoal's `ready` flag is derived from that.
 */
const EMPTY_STATE: DailyGoalState = { day: '', ids: [] };

let cachedState: DailyGoalState = EMPTY_STATE;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

/**
 * Returns a stable reference when nothing has changed (required by
 * useSyncExternalStore to avoid re-rendering every call), re-reading from
 * localStorage only when the local calendar day has moved on from what's
 * cached — which covers both the first read after mount and a real midnight
 * rollover.
 */
const getSnapshot = (): DailyGoalState => {
  const todayKey = localDayKey(new Date());
  if (cachedState.day === todayKey) return cachedState;
  cachedState = readDailyGoal(todayKey);
  return cachedState;
};

const getServerSnapshot = (): DailyGoalState => EMPTY_STATE;

/**
 * The app is a fixed-inset PWA meant to be left open, so a tab left open
 * across local midnight needs to notice on its own. There's no reliable
 * "at midnight" timer in a backgrounded PWA, so re-check on the signals the
 * user can actually produce: the tab regaining visibility or focus.
 */
const subscribe = (onStoreChange: () => void): (() => void) => {
  listeners.add(onStoreChange);
  document.addEventListener('visibilitychange', onStoreChange);
  window.addEventListener('focus', onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    document.removeEventListener('visibilitychange', onStoreChange);
    window.removeEventListener('focus', onStoreChange);
  };
};

export const useDailyGoal = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = state.day !== '';

  const [justCompleted, setJustCompleted] = useState(false);
  const justCompletedTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const recordCorrect = useCallback((vocabularyId: number) => {
    const current = getSnapshot();
    const wasCompleted = dailyGoalProgress(current).completed;

    const next = recordCorrectWord(current, vocabularyId);
    if (next === current) return;

    cachedState = next;
    writeDailyGoal(next);
    notify();

    if (dailyGoalProgress(next).completed && !wasCompleted) {
      clearTimeout(justCompletedTimeoutRef.current);
      setJustCompleted(true);
      justCompletedTimeoutRef.current = setTimeout(() => setJustCompleted(false), 1000);
    }
  }, []);

  const progress = dailyGoalProgress(state);

  return {
    ready,
    count: progress.count,
    goal: DAILY_GOAL,
    completed: progress.completed,
    percentage: progress.percentage,
    justCompleted,
    recordCorrect,
  };
};
