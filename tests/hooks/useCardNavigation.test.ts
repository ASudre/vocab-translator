import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardNavigation } from '@/hooks/useCardNavigation';

describe('useCardNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at index 0 with no slide/shake', () => {
    const { result } = renderHook(() => useCardNavigation(5));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.slideDirection).toBeNull();
    expect(result.current.shakeAnimation).toBe(false);
  });

  it('goToNext slides left then advances the index after 300ms', () => {
    const { result } = renderHook(() => useCardNavigation(5));

    act(() => result.current.goToNext());
    expect(result.current.slideDirection).toBe('left');
    expect(result.current.currentIndex).toBe(0);

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.slideDirection).toBeNull();
  });

  it('goToNext is a no-op at the last card', () => {
    const { result } = renderHook(() => useCardNavigation(1));
    act(() => result.current.goToNext());
    expect(result.current.slideDirection).toBeNull();
    expect(result.current.currentIndex).toBe(0);
  });

  it('goToPrevious slides right then decrements after 300ms', () => {
    const { result, rerender } = renderHook(({ total }) => useCardNavigation(total), { initialProps: { total: 5 } });

    act(() => result.current.goToNext());
    act(() => vi.advanceTimersByTime(300));
    rerender({ total: 5 });
    expect(result.current.currentIndex).toBe(1);

    act(() => result.current.goToPrevious());
    expect(result.current.slideDirection).toBe('right');

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.currentIndex).toBe(0);
  });

  it('goToPrevious is a no-op at the first card', () => {
    const { result } = renderHook(() => useCardNavigation(5));
    act(() => result.current.goToPrevious());
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.slideDirection).toBeNull();
  });

  it('triggerShake sets shakeAnimation then clears it after 500ms', () => {
    const { result } = renderHook(() => useCardNavigation(5));

    act(() => result.current.triggerShake());
    expect(result.current.shakeAnimation).toBe(true);

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.shakeAnimation).toBe(false);
  });

  it('autoAdvance waits 500ms, then slides and advances after another 300ms', () => {
    const { result } = renderHook(() => useCardNavigation(5));

    act(() => result.current.autoAdvance());
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.slideDirection).toBeNull();

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.slideDirection).toBe('left');
    expect(result.current.currentIndex).toBe(0);

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.slideDirection).toBeNull();
  });

  it('autoAdvance does nothing once the 500ms timer fires past the last card', () => {
    const { result } = renderHook(() => useCardNavigation(1));

    act(() => result.current.autoAdvance());
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.slideDirection).toBeNull();
  });

  it('reset returns to index 0 and clears slide/shake state', () => {
    const { result } = renderHook(() => useCardNavigation(5));

    act(() => result.current.goToNext());
    act(() => vi.advanceTimersByTime(300));
    act(() => result.current.triggerShake());

    act(() => result.current.reset());
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.slideDirection).toBeNull();
    expect(result.current.shakeAnimation).toBe(false);
  });

  it('documents the lack of timer cleanup: reset does not cancel an in-flight autoAdvance', () => {
    const { result, rerender } = renderHook(({ total }) => useCardNavigation(total), { initialProps: { total: 5 } });

    // Advance to index 2.
    act(() => result.current.goToNext());
    act(() => vi.advanceTimersByTime(300));
    rerender({ total: 5 });
    act(() => result.current.goToNext());
    act(() => vi.advanceTimersByTime(300));
    rerender({ total: 5 });
    expect(result.current.currentIndex).toBe(2);

    act(() => result.current.autoAdvance()); // schedules currentIndex(2) + 1, 800ms out
    act(() => result.current.reset());
    expect(result.current.currentIndex).toBe(0);

    // The stale autoAdvance timer still fires later with the closure it
    // captured (currentIndex === 2 at call time) and bumps to 3, even
    // though reset() already ran and the UI shows index 0. This is a known
    // bug pinned here so a future fix (clearing timers on reset/unmount)
    // shows up as a deliberate test change rather than a silent drift.
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.currentIndex).toBe(3);
  });
});
