import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import {
  DAILY_GOAL,
  LEARNING_DAILY_GOAL_KEY,
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

interface Store {
  getSnapshot: () => DailyGoalState;
  getServerSnapshot: () => DailyGoalState;
  subscribe: (onStoreChange: () => void) => () => void;
  recordCorrect: (vocabularyId: number, onJustCompleted: () => void) => void;
}

/**
 * One independent cache/listener set per storage key (learning, revision, ...),
 * created once and reused - useSyncExternalStore requires subscribe/getSnapshot
 * to keep a stable reference across renders for a given key, not a fresh
 * closure every call.
 */
const stores = new Map<string, Store>();

const createStore = (storageKey: string): Store => {
  let cachedState: DailyGoalState = EMPTY_STATE;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach(listener => listener());

  const getSnapshot = (): DailyGoalState => {
    const todayKey = localDayKey(new Date());
    if (cachedState.day === todayKey) return cachedState;
    cachedState = readDailyGoal(storageKey, todayKey);
    return cachedState;
  };

  const getServerSnapshot = (): DailyGoalState => EMPTY_STATE;

  // The app is a fixed-inset PWA meant to be left open, so a tab left open
  // across local midnight needs to notice on its own. There's no reliable
  // "at midnight" timer in a backgrounded PWA, so re-check on the signals the
  // user can actually produce: the tab regaining visibility or focus.
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

  const recordCorrect = (vocabularyId: number, onJustCompleted: () => void) => {
    const current = getSnapshot();
    const wasCompleted = dailyGoalProgress(current).completed;

    const next = recordCorrectWord(current, vocabularyId);
    if (next === current) return;

    cachedState = next;
    writeDailyGoal(storageKey, next);
    notify();

    if (dailyGoalProgress(next).completed && !wasCompleted) {
      onJustCompleted();
    }
  };

  return { getSnapshot, getServerSnapshot, subscribe, recordCorrect };
};

const getStore = (storageKey: string): Store => {
  let store = stores.get(storageKey);
  if (!store) {
    store = createStore(storageKey);
    stores.set(storageKey, store);
  }
  return store;
};

export const useDailyGoal = (storageKey: string = LEARNING_DAILY_GOAL_KEY, goal: number = DAILY_GOAL) => {
  const store = getStore(storageKey);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = state.day !== '';

  const [justCompleted, setJustCompleted] = useState(false);
  const justCompletedTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const recordCorrect = useCallback((vocabularyId: number) => {
    store.recordCorrect(vocabularyId, () => {
      clearTimeout(justCompletedTimeoutRef.current);
      setJustCompleted(true);
      justCompletedTimeoutRef.current = setTimeout(() => setJustCompleted(false), 1000);
    });
  }, [store]);

  const progress = dailyGoalProgress(state, goal);

  return {
    ready,
    count: progress.count,
    goal,
    completed: progress.completed,
    percentage: progress.percentage,
    justCompleted,
    recordCorrect,
  };
};
