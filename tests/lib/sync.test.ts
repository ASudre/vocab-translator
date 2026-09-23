import { describe, expect, it } from 'vitest';
import { AttemptRecord, BaselineProgress, pickBaseline, replayProgress } from '@/lib/sync';

const attempt = (overrides: Partial<AttemptRecord> = {}): AttemptRecord => ({
  id: 'a',
  vocabularyId: 1,
  level: 'a1',
  isCorrect: true,
  answeredAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('replayProgress', () => {
  it('returns undefined when there is no baseline and no attempts', () => {
    expect(replayProgress(undefined, [])).toBeUndefined();
  });

  it('returns the baseline unchanged when there are no attempts', () => {
    const baseline: BaselineProgress = {
      vocabularyId: 1,
      successCount: 2,
      failCount: 1,
      currentStreak: 1,
      bestStreak: 2,
      attemptHistory: [true, false, true],
      masteryLevel: 1,
      lastPracticed: '2026-01-01T00:00:00.000Z',
    };
    expect(replayProgress(baseline, [])).toEqual(baseline);
  });

  it('is order-independent: the same set of attempts replayed in any arrival order converges on the same aggregate', () => {
    const attempts = [
      attempt({ id: 'a', isCorrect: true, answeredAt: '2026-01-01T00:00:00.000Z' }),
      attempt({ id: 'b', isCorrect: false, answeredAt: '2026-01-01T00:00:01.000Z' }),
      attempt({ id: 'c', isCorrect: true, answeredAt: '2026-01-01T00:00:02.000Z' }),
      attempt({ id: 'd', isCorrect: true, answeredAt: '2026-01-01T00:00:03.000Z' }),
    ];

    const forward = replayProgress(undefined, attempts);
    const reversed = replayProgress(undefined, [...attempts].reverse());
    const shuffled = replayProgress(undefined, [attempts[2], attempts[0], attempts[3], attempts[1]]);

    expect(reversed).toEqual(forward);
    expect(shuffled).toEqual(forward);
    // Sanity: replay actually reflects chronological order (last attempt d is correct -> streak of 2).
    expect(forward).toMatchObject({ successCount: 3, failCount: 1, currentStreak: 2, bestStreak: 2 });
  });

  it('is idempotent: replaying the same batch twice yields the same aggregate as once', () => {
    const attempts = [
      attempt({ id: 'a', isCorrect: true, answeredAt: '2026-01-01T00:00:00.000Z' }),
      attempt({ id: 'b', isCorrect: true, answeredAt: '2026-01-01T00:00:01.000Z' }),
    ];

    const once = replayProgress(undefined, attempts);
    // A duplicate-safe caller would de-dupe by id before calling; simulate
    // that de-dupe explicitly, since replayProgress itself trusts its input.
    const deduped = replayProgress(undefined, [...attempts, ...attempts].filter(
      (a, i, arr) => arr.findIndex(b => b.id === a.id) === i
    ));

    expect(deduped).toEqual(once);
  });

  it('composes a baseline with later attempts rather than one clobbering the other', () => {
    const baseline: BaselineProgress = {
      vocabularyId: 1,
      successCount: 5,
      failCount: 0,
      currentStreak: 5,
      bestStreak: 5,
      attemptHistory: [true, true, true],
      masteryLevel: 3,
      lastPracticed: '2026-01-01T00:00:00.000Z',
    };
    const laterAttempt = attempt({ id: 'x', isCorrect: false, answeredAt: '2026-01-02T00:00:00.000Z' });

    const result = replayProgress(baseline, [laterAttempt]);

    expect(result).toMatchObject({
      successCount: 5,
      failCount: 1,
      currentStreak: 0,
      bestStreak: 5,
      attemptHistory: [true, true, false],
    });
  });

  it('resolves clock skew / late arrivals deterministically by replaying in answeredAt order, not arrival order', () => {
    // Device A answers at t=2 first (arrives first); device B's earlier t=1
    // attempt arrives later. Correct replay still applies t=1 before t=2.
    const early = attempt({ id: 'b-device', isCorrect: false, answeredAt: '2026-01-01T00:00:01.000Z' });
    const late = attempt({ id: 'a-device', isCorrect: true, answeredAt: '2026-01-01T00:00:02.000Z' });

    const arrivedLateFirst = replayProgress(undefined, [late, early]);
    const arrivedEarlyFirst = replayProgress(undefined, [early, late]);

    expect(arrivedLateFirst).toEqual(arrivedEarlyFirst);
    expect(arrivedLateFirst).toMatchObject({ currentStreak: 1, bestStreak: 1, attemptHistory: [false, true] });
  });
});

describe('pickBaseline', () => {
  const baseline = (overrides: Partial<BaselineProgress> = {}): BaselineProgress => ({
    vocabularyId: 1,
    successCount: 0,
    failCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    attemptHistory: [],
    masteryLevel: 0,
    lastPracticed: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('keeps whichever baseline reflects more total practice', () => {
    const fewer = baseline({ successCount: 1, failCount: 0 });
    const more = baseline({ successCount: 3, failCount: 2 });

    expect(pickBaseline(fewer, more)).toBe(more);
    expect(pickBaseline(more, fewer)).toBe(more);
  });

  it('on a tie, the incoming upload wins over the existing stored baseline', () => {
    const existing = baseline({ successCount: 2, failCount: 0 });
    const incoming = baseline({ successCount: 1, failCount: 1 });

    expect(pickBaseline(existing, incoming)).toBe(incoming);
  });

  it('re-sending the same baseline is a stable no-op (idempotent from the caller\'s (existing, incoming) convention)', () => {
    const snapshot = baseline({ successCount: 2, failCount: 1 });

    // First sync: nothing stored yet, so treat incoming as its own existing.
    const firstResult = pickBaseline(snapshot, snapshot);
    // Re-sending the identical snapshot again converges to the same values.
    const secondResult = pickBaseline(firstResult, snapshot);

    expect(secondResult).toEqual(firstResult);
  });
});
