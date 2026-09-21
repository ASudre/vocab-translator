export const COMBO_STORAGE_KEY = 'vocabDB_combo';

export interface ComboState {
  current: number;
  best: number;
}

const EMPTY_COMBO: ComboState = { current: 0, best: 0 };

const isValidComboState = (value: unknown): value is ComboState => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.current === 'number' && Number.isInteger(candidate.current) && candidate.current >= 0 &&
    typeof candidate.best === 'number' && Number.isInteger(candidate.best) && candidate.best >= 0
  );
};

/**
 * Read the persisted combo, self-healing to a fresh zero state whenever
 * nothing is stored, or the stored value is malformed JSON or the wrong
 * shape. Malformed JSON also clears the key, mirroring readPendingWord.
 * Unlike the daily goal, there's no day key to compare — combo persists
 * indefinitely.
 */
export const readCombo = (): ComboState => {
  const raw = localStorage.getItem(COMBO_STORAGE_KEY);
  if (!raw) return EMPTY_COMBO;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    localStorage.removeItem(COMBO_STORAGE_KEY);
    return EMPTY_COMBO;
  }

  if (!isValidComboState(parsed)) return EMPTY_COMBO;
  return parsed;
};

/**
 * Wrapped in try/catch so a full or disabled localStorage (Safari private
 * mode, iOS quota) can't surface as a failed answer.
 */
export const writeCombo = (state: ComboState): void => {
  try {
    localStorage.setItem(COMBO_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save combo progress:', error);
  }
};

/**
 * A correct attempt extends the run (and best, if this is a new record); an
 * incorrect attempt (including revealing the solution) resets it to 0.
 * Returns the identical reference when a miss follows a miss (current
 * already 0), so callers can skip a pointless write/re-render.
 */
export const recordAttempt = (state: ComboState, isCorrect: boolean): ComboState => {
  if (isCorrect) {
    const current = state.current + 1;
    return { current, best: Math.max(state.best, current) };
  }

  if (state.current === 0) return state;
  return { ...state, current: 0 };
};
