import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { COMBO_STORAGE_KEY } from '@/lib/combo';

// useCombo caches the current ComboState at module scope (required so
// useSyncExternalStore's getSnapshot can return a stable reference across
// calls). Re-import it fresh for every test so one test's combo can't leak
// into the next, mirroring the freshIndexedDB pattern in
// tests/lib/indexedDB.test.ts and useDailyGoal's own test file.
const freshUseCombo = async () => {
  vi.resetModules();
  const mod = await import('@/hooks/useCombo');
  return mod.useCombo;
};

describe('useCombo', () => {
  let useCombo: Awaited<ReturnType<typeof freshUseCombo>>;

  beforeEach(async () => {
    localStorage.clear();
    useCombo = await freshUseCombo();
  });

  it('is ready immediately at 0/0 when nothing is stored', () => {
    const { result } = renderHook(() => useCombo());
    expect(result.current.ready).toBe(true);
    expect(result.current.currentCombo).toBe(0);
    expect(result.current.best).toBe(0);
  });

  it('restores an existing combo', () => {
    localStorage.setItem(COMBO_STORAGE_KEY, JSON.stringify({ current: 3, best: 9 }));

    const { result } = renderHook(() => useCombo());
    expect(result.current.currentCombo).toBe(3);
    expect(result.current.best).toBe(9);
  });

  it('recordAttempt(true) increments current and persists it', () => {
    const { result } = renderHook(() => useCombo());

    act(() => result.current.recordAttempt(true));
    expect(result.current.currentCombo).toBe(1);
    expect(result.current.best).toBe(1);

    expect(JSON.parse(localStorage.getItem(COMBO_STORAGE_KEY)!)).toEqual({ current: 1, best: 1 });
  });

  it('recordAttempt(false) resets current but keeps best', () => {
    const { result } = renderHook(() => useCombo());

    act(() => {
      result.current.recordAttempt(true);
      result.current.recordAttempt(true);
      result.current.recordAttempt(true);
    });
    expect(result.current.currentCombo).toBe(3);

    act(() => result.current.recordAttempt(false));
    expect(result.current.currentCombo).toBe(0);
    expect(result.current.best).toBe(3);
  });

  it('best only ever grows, never shrinks across ups and downs', () => {
    const { result } = renderHook(() => useCombo());

    act(() => {
      result.current.recordAttempt(true);
      result.current.recordAttempt(true);
      result.current.recordAttempt(false);
      result.current.recordAttempt(true);
    });

    expect(result.current.currentCombo).toBe(1);
    expect(result.current.best).toBe(2);
  });

  it('shares state across multiple mounted instances', () => {
    const a = renderHook(() => useCombo());
    const b = renderHook(() => useCombo());

    act(() => a.result.current.recordAttempt(true));

    expect(a.result.current.currentCombo).toBe(1);
    expect(b.result.current.currentCombo).toBe(1);
  });

  it('does not persist across a truly fresh module (no day-based expiry, just isolation per test)', async () => {
    const { result } = renderHook(() => useCombo());
    act(() => result.current.recordAttempt(true));
    expect(result.current.currentCombo).toBe(1);

    const freshHook = await freshUseCombo();
    localStorage.clear();
    const { result: freshResult } = renderHook(() => freshHook());
    expect(freshResult.current.currentCombo).toBe(0);
  });
});
