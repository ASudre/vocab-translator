import { useCallback, useSyncExternalStore } from 'react';
import { ComboState, readCombo, writeCombo, recordAttempt } from '@/lib/combo';

/**
 * Sentinel used as the pre-hydration snapshot (this app is statically
 * exported and force-static, so localStorage doesn't exist at prerender).
 * A negative `current` is otherwise impossible, so it doubles as the
 * "not hydrated yet" signal for `ready` below.
 */
const UNREADY_STATE: ComboState = { current: -1, best: -1 };

let cachedState: ComboState = UNREADY_STATE;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

const getSnapshot = (): ComboState => {
  if (cachedState !== UNREADY_STATE) return cachedState;
  cachedState = readCombo();
  return cachedState;
};

const getServerSnapshot = (): ComboState => UNREADY_STATE;

/**
 * Unlike useDailyGoal, combo has no day boundary to roll over — its only
 * mutation source is this hook's own recordAttempt, so subscribing just
 * tracks listeners for the notify-after-write loop below; no DOM listeners
 * needed.
 */
const subscribe = (onStoreChange: () => void): (() => void) => {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
};

export const useCombo = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = state !== UNREADY_STATE;

  const recordComboAttempt = useCallback((isCorrect: boolean) => {
    const current = getSnapshot();
    const next = recordAttempt(current, isCorrect);
    if (next === current) return;

    cachedState = next;
    writeCombo(next);
    notify();
  }, []);

  return {
    ready,
    // Named currentCombo (not `current`) so consumers destructuring it don't
    // trip react-hooks/exhaustive-deps's ref-detection heuristic, which
    // treats any `.current` access as a possible ref regardless of origin.
    currentCombo: ready ? state.current : 0,
    best: ready ? state.best : 0,
    recordAttempt: recordComboAttempt,
  };
};
