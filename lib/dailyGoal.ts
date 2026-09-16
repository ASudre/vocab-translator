export const DAILY_GOAL = 10;

export const DAILY_GOAL_STORAGE_KEY = 'vocabDB_dailyGoal';

export interface DailyGoalState {
  /** 'YYYY-MM-DD', local calendar day this state belongs to. */
  day: string;
  /** Distinct vocabularyIds answered correctly on `day`. */
  ids: number[];
}

/** 'YYYY-MM-DD' built from local date components (never toISOString/UTC). */
export const localDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isValidState = (value: unknown): value is DailyGoalState => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.day === 'string' &&
    Array.isArray(candidate.ids) &&
    candidate.ids.every(id => typeof id === 'number')
  );
};

/**
 * Read today's goal state, self-healing to a fresh empty state whenever
 * nothing is stored, the stored day doesn't match today (a new day always
 * starts empty), or the stored value is malformed JSON or the wrong shape.
 * Malformed JSON also clears the key, mirroring readPendingWord.
 */
export const readDailyGoal = (todayKey: string): DailyGoalState => {
  const fresh: DailyGoalState = { day: todayKey, ids: [] };
  const raw = localStorage.getItem(DAILY_GOAL_STORAGE_KEY);
  if (!raw) return fresh;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    localStorage.removeItem(DAILY_GOAL_STORAGE_KEY);
    return fresh;
  }

  if (!isValidState(parsed) || parsed.day !== todayKey) return fresh;
  return parsed;
};

/**
 * Wrapped in try/catch so a full or disabled localStorage (Safari private
 * mode, iOS quota) can't surface as a failed answer.
 */
export const writeDailyGoal = (state: DailyGoalState): void => {
  try {
    localStorage.setItem(DAILY_GOAL_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save daily goal progress:', error);
  }
};

/**
 * Add a correctly-answered word to today's state. Returns the identical
 * object reference when the id is already recorded, so callers can skip a
 * pointless write/re-render.
 */
export const recordCorrectWord = (state: DailyGoalState, vocabularyId: number): DailyGoalState => {
  if (state.ids.includes(vocabularyId)) return state;
  return { ...state, ids: [...state.ids, vocabularyId] };
};

export const dailyGoalProgress = (
  state: DailyGoalState,
  goal: number = DAILY_GOAL
): { count: number; goal: number; completed: boolean; percentage: number } => {
  const count = state.ids.length;
  return {
    count,
    goal,
    completed: count >= goal,
    percentage: goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0,
  };
};
