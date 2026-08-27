import { describe, it, expect, beforeEach } from 'vitest';
import { LEVEL_STORAGE_KEY, pendingWordKey, isCEFRLevel, readPendingWord } from '@/lib/pendingWord';

describe('pendingWordKey', () => {
  it('namespaces the key per level', () => {
    expect(pendingWordKey('a1')).toBe('vocabDB_pendingWord_a1');
    expect(pendingWordKey('c1')).toBe('vocabDB_pendingWord_c1');
  });
});

describe('LEVEL_STORAGE_KEY', () => {
  it('is a stable constant', () => {
    expect(LEVEL_STORAGE_KEY).toBe('vocabDB_selectedLevel');
  });
});

describe('isCEFRLevel', () => {
  it('accepts every known CEFR level', () => {
    for (const level of ['a1', 'a2', 'b1', 'b2', 'c1']) {
      expect(isCEFRLevel(level)).toBe(true);
    }
  });

  it('rejects null, empty string, and unknown values', () => {
    expect(isCEFRLevel(null)).toBe(false);
    expect(isCEFRLevel('')).toBe(false);
    expect(isCEFRLevel('d1')).toBe(false);
    expect(isCEFRLevel('A1')).toBe(false); // case-sensitive
  });
});

describe('readPendingWord', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(readPendingWord('a1')).toBeNull();
  });

  it('parses a stored word', () => {
    const word = { vocabularyId: 1, spanish: 'hola', french: 'bonjour', class: 'interjection', category: 'greeting' };
    localStorage.setItem(pendingWordKey('a1'), JSON.stringify(word));
    expect(readPendingWord('a1')).toEqual(word);
  });

  it('self-heals and clears the key on malformed JSON', () => {
    localStorage.setItem(pendingWordKey('a1'), '{not valid json');
    expect(readPendingWord('a1')).toBeNull();
    expect(localStorage.getItem(pendingWordKey('a1'))).toBeNull();
  });

  it('does not validate the shape of well-formed JSON (documents current behaviour)', () => {
    localStorage.setItem(pendingWordKey('a1'), JSON.stringify({ unrelated: true }));
    // No throw and no self-heal here: the wrong shape is returned as-is.
    expect(readPendingWord('a1')).toEqual({ unrelated: true });
  });

  it('is scoped per level', () => {
    localStorage.setItem(pendingWordKey('a1'), JSON.stringify({ vocabularyId: 1 }));
    expect(readPendingWord('a2')).toBeNull();
  });
});
