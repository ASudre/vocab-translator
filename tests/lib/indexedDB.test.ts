import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { VocabularyEntry } from '@/lib/indexedDB';

// lib/indexedDB.ts memoizes its DB connection at module scope (`dbInstance`),
// and fake-indexeddb persists data across tests unless given a fresh
// backing store. Reset both before every test by re-importing the module
// against a brand new IDBFactory.
const freshIndexedDB = async () => {
  vi.resetModules();
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  return import('@/lib/indexedDB');
};

describe('lib/indexedDB', () => {
  let db: typeof import('@/lib/indexedDB');

  beforeEach(async () => {
    db = await freshIndexedDB();
  });

  const sampleEntries: VocabularyEntry[] = [
    { id: 1, English: 'hello', Español: 'hola', Français: 'bonjour', Category: 'greeting', Class: 'interjection' },
    { id: 2, English: 'goodbye', Español: 'adios', Français: 'au revoir', Category: 'greeting', Class: 'interjection' },
    { id: 3, English: 'cat', Español: 'gato', Français: 'chat', Category: 'animal', Class: 'noun' },
  ];

  describe('importVocabulary / getVocabularyCount / clearVocabulary', () => {
    it('round-trips vocabulary through the store', async () => {
      expect(await db.getVocabularyCount()).toBe(0);

      await db.importVocabulary(sampleEntries);
      expect(await db.getVocabularyCount()).toBe(3);

      await db.clearVocabulary();
      expect(await db.getVocabularyCount()).toBe(0);
    });
  });

  describe('saveUserProgress / getUserProgress', () => {
    it('creates a new progress record on the first attempt', async () => {
      await db.saveUserProgress(1, true);
      const progress = await db.getUserProgress(1);
      expect(progress).toMatchObject({
        vocabularyId: 1,
        successCount: 1,
        failCount: 0,
        currentStreak: 1,
        masteryLevel: 1,
        attemptHistory: [true],
      });
    });

    it('accumulates attempts into the rolling mastery calculation', async () => {
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true);

      const progress = await db.getUserProgress(1);
      expect(progress?.masteryLevel).toBe(3);
      expect(progress?.attemptHistory).toEqual([true, true, true]);
    });

    it('returns null for a word with no recorded progress', async () => {
      expect(await db.getUserProgress(999)).toBeNull();
    });
  });

  describe('getUnmasteredVocabulary', () => {
    it('excludes words at mastery level 3', async () => {
      await db.importVocabulary(sampleEntries);
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true); // word 1 is now mastered (level 3)

      const unmastered = await db.getUnmasteredVocabulary(10);
      const ids = unmastered.map(w => w.id).sort();
      expect(ids).toEqual([2, 3]);
    });

    it('returns all words when none are mastered', async () => {
      await db.importVocabulary(sampleEntries);
      const unmastered = await db.getUnmasteredVocabulary(10);
      expect(unmastered).toHaveLength(3);
    });
  });

  describe('getMasteryStats', () => {
    it('scopes stats to the currently loaded level, ignoring progress from other levels', async () => {
      await db.importVocabulary(sampleEntries); // this "level" only has ids 1-3
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true); // word 1: mastered
      await db.saveUserProgress(999, true); // word from a different level, should not count

      const stats = await db.getMasteryStats();
      expect(stats.total).toBe(3);
      expect(stats.mastered).toBe(1);
    });

    it('returns zero percentage with no words loaded', async () => {
      const stats = await db.getMasteryStats();
      expect(stats).toEqual({ total: 0, mastered: 0, percentage: 0 });
    });
  });

  describe('loadVocabularyFromJSON', () => {
    const mockFetch = (payload: unknown) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
        json: () => Promise.resolve(payload),
      }));
    };

    it('loads and normalizes vocabulary on first load', async () => {
      mockFetch({
        version: '1.0.0',
        list: [{ id: 1, spanish: 'hola', french: 'bonjour', english: 'hello', category: 'greeting', class: 'interjection' }],
      });

      await db.loadVocabularyFromJSON('/a1.json', 'a1');
      expect(await db.getVocabularyCount()).toBe(1);
      expect(localStorage.getItem('vocabDB_version_a1')).toBe('1.0.0');
      expect(localStorage.getItem('vocabDB_activeLevel')).toBe('a1');
    });

    it('does not reload when the same level and version are already active', async () => {
      mockFetch({ version: '1.0.0', list: [{ id: 1, spanish: 'hola' }] });
      await db.loadVocabularyFromJSON('/a1.json', 'a1');

      mockFetch({ version: '1.0.0', list: [{ id: 1, spanish: 'hola' }, { id: 2, spanish: 'adios' }] });
      await db.loadVocabularyFromJSON('/a1.json', 'a1');

      // Second call's extra entry should NOT have been imported, since the version matched.
      expect(await db.getVocabularyCount()).toBe(1);
    });

    it('reloads when the version changes', async () => {
      mockFetch({ version: '1.0.0', list: [{ id: 1, spanish: 'hola' }] });
      await db.loadVocabularyFromJSON('/a1.json', 'a1');

      mockFetch({ version: '1.0.1', list: [{ id: 1, spanish: 'hola' }, { id: 2, spanish: 'adios' }] });
      await db.loadVocabularyFromJSON('/a1.json', 'a1');

      expect(await db.getVocabularyCount()).toBe(2);
      expect(localStorage.getItem('vocabDB_version_a1')).toBe('1.0.1');
    });

    it('throws when the fetch response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, statusText: 'Not Found' }));
      await expect(db.loadVocabularyFromJSON('/missing.json', 'a1')).rejects.toThrow();
    });
  });
});
