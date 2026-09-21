import { describe, it, expect, beforeEach } from 'vitest';
import { COMBO_STORAGE_KEY, readCombo, writeCombo, recordAttempt, ComboState } from '@/lib/combo';

describe('readCombo', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a fresh zero state when nothing is stored', () => {
    expect(readCombo()).toEqual({ current: 0, best: 0 });
  });

  it('restores a stored state', () => {
    const state: ComboState = { current: 3, best: 12 };
    localStorage.setItem(COMBO_STORAGE_KEY, JSON.stringify(state));
    expect(readCombo()).toEqual(state);
  });

  it('self-heals and clears the key on malformed JSON', () => {
    localStorage.setItem(COMBO_STORAGE_KEY, '{not valid json');
    expect(readCombo()).toEqual({ current: 0, best: 0 });
    expect(localStorage.getItem(COMBO_STORAGE_KEY)).toBeNull();
  });

  it('returns a fresh state for well-formed JSON with the wrong shape', () => {
    localStorage.setItem(COMBO_STORAGE_KEY, JSON.stringify({ current: 'nope', best: 12 }));
    expect(readCombo()).toEqual({ current: 0, best: 0 });
  });

  it('returns a fresh state for negative or non-integer values', () => {
    localStorage.setItem(COMBO_STORAGE_KEY, JSON.stringify({ current: -1, best: 12 }));
    expect(readCombo()).toEqual({ current: 0, best: 0 });

    localStorage.setItem(COMBO_STORAGE_KEY, JSON.stringify({ current: 1.5, best: 12 }));
    expect(readCombo()).toEqual({ current: 0, best: 0 });
  });

  it('does not reset on a new day (no day key, unlike the daily goal)', () => {
    const state: ComboState = { current: 5, best: 5 };
    localStorage.setItem(COMBO_STORAGE_KEY, JSON.stringify(state));
    expect(readCombo()).toEqual(state);
  });
});

describe('writeCombo', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists state that readCombo can read back', () => {
    const state: ComboState = { current: 4, best: 9 };
    writeCombo(state);
    expect(readCombo()).toEqual(state);
  });

  it('does not throw when localStorage.setItem throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => writeCombo({ current: 1, best: 1 })).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe('recordAttempt', () => {
  it('extends the current run on a correct attempt', () => {
    const result = recordAttempt({ current: 3, best: 5 }, true);
    expect(result).toEqual({ current: 4, best: 5 });
  });

  it('raises best when the current run surpasses it', () => {
    const result = recordAttempt({ current: 5, best: 5 }, true);
    expect(result).toEqual({ current: 6, best: 6 });
  });

  it('resets current to 0 on an incorrect attempt, keeping best', () => {
    const result = recordAttempt({ current: 7, best: 9 }, false);
    expect(result).toEqual({ current: 0, best: 9 });
  });

  it('returns the identical reference for a miss following a miss', () => {
    const state: ComboState = { current: 0, best: 9 };
    const result = recordAttempt(state, false);
    expect(result).toBe(state);
  });

  it('builds up from zero across consecutive correct attempts', () => {
    let state: ComboState = { current: 0, best: 0 };
    state = recordAttempt(state, true);
    state = recordAttempt(state, true);
    state = recordAttempt(state, true);
    expect(state).toEqual({ current: 3, best: 3 });
  });
});
