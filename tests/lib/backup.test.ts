import { describe, it, expect } from 'vitest';
import { BACKUP_VERSION, buildBackupPayload, parseBackupPayload } from '@/lib/backup';
import { UserProgress } from '@/lib/indexedDB';

const progressRow = (overrides: Partial<UserProgress> = {}): UserProgress => ({
  id: 1,
  vocabularyId: 42,
  successCount: 3,
  failCount: 1,
  bestStreak: 3,
  currentStreak: 3,
  lastPracticed: '2026-01-01T00:00:00.000Z',
  attemptHistory: [true, true, true],
  masteryLevel: 3,
  ...overrides,
});

describe('buildBackupPayload', () => {
  it('wraps the given rows with a version and export timestamp', () => {
    const now = new Date('2026-03-05T12:00:00.000Z');
    const payload = buildBackupPayload([progressRow()], now);

    expect(payload.version).toBe(BACKUP_VERSION);
    expect(payload.exportedAt).toBe('2026-03-05T12:00:00.000Z');
    expect(payload.progress).toHaveLength(1);
  });

  it('strips the local autoIncrement id from every row', () => {
    const payload = buildBackupPayload([progressRow({ id: 7 })]);
    expect(payload.progress[0]).not.toHaveProperty('id');
    expect(payload.progress[0]).toMatchObject({ vocabularyId: 42, masteryLevel: 3 });
  });

  it('returns an empty progress array for no rows', () => {
    expect(buildBackupPayload([]).progress).toEqual([]);
  });
});

describe('parseBackupPayload', () => {
  it('round-trips a payload built by buildBackupPayload', () => {
    const built = buildBackupPayload([progressRow()], new Date('2026-03-05T12:00:00.000Z'));
    expect(parseBackupPayload(built)).toEqual(built);
  });

  it('rejects a payload with the wrong version', () => {
    const built = buildBackupPayload([progressRow()]);
    expect(parseBackupPayload({ ...built, version: 99 })).toBeNull();
  });

  it('rejects a payload missing exportedAt', () => {
    const withoutDate: Record<string, unknown> = { ...buildBackupPayload([progressRow()]) };
    delete withoutDate.exportedAt;
    expect(parseBackupPayload(withoutDate)).toBeNull();
  });

  it('rejects a payload whose progress is not an array', () => {
    const built = buildBackupPayload([progressRow()]);
    expect(parseBackupPayload({ ...built, progress: 'nope' })).toBeNull();
  });

  it('rejects a payload containing a malformed progress row', () => {
    const built = buildBackupPayload([progressRow()]);
    expect(parseBackupPayload({ ...built, progress: [{ vocabularyId: 1 }] })).toBeNull();
  });

  it('rejects non-object input', () => {
    expect(parseBackupPayload(null)).toBeNull();
    expect(parseBackupPayload('a string')).toBeNull();
    expect(parseBackupPayload(42)).toBeNull();
  });
});
