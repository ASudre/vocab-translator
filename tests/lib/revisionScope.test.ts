import { describe, it, expect, beforeEach } from 'vitest';
import { REVISION_SCOPE_KEY, readRevisionScope, writeRevisionScope } from '@/lib/revisionScope';

describe('readRevisionScope', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 'level' when nothing is stored", () => {
    expect(readRevisionScope()).toBe('level');
  });

  it('restores a stored scope', () => {
    localStorage.setItem(REVISION_SCOPE_KEY, 'all');
    expect(readRevisionScope()).toBe('all');
  });

  it("self-heals to 'level' for an unrecognized value", () => {
    localStorage.setItem(REVISION_SCOPE_KEY, 'nonsense');
    expect(readRevisionScope()).toBe('level');
  });
});

describe('writeRevisionScope', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists a scope that readRevisionScope can read back', () => {
    writeRevisionScope('all');
    expect(readRevisionScope()).toBe('all');
  });

  it('does not throw when localStorage.setItem throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => writeRevisionScope('all')).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
