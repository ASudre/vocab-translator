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
    { id: 1, English: 'hello', Español: 'hola', Français: 'bonjour', Category: 'greeting', Class: 'interjection', level: 'a1' },
    { id: 2, English: 'goodbye', Español: 'adios', Français: 'au revoir', Category: 'greeting', Class: 'interjection', level: 'a1' },
    { id: 3, English: 'cat', Español: 'gato', Français: 'chat', Category: 'animal', Class: 'noun', level: 'a1' },
  ];

  describe('importVocabulary / getVocabularyCount / clearVocabulary', () => {
    it('round-trips vocabulary through the store', async () => {
      expect(await db.getVocabularyCount()).toBe(0);

      await db.importVocabulary(sampleEntries);
      expect(await db.getVocabularyCount()).toBe(3);

      await db.clearVocabulary();
      expect(await db.getVocabularyCount()).toBe(0);
    });

    it('is idempotent: importing the same id twice overwrites rather than throwing', async () => {
      await db.importVocabulary(sampleEntries);
      await db.importVocabulary([{ ...sampleEntries[0], Français: 'salut' }]);

      expect(await db.getVocabularyCount()).toBe(3);
      const words = await db.getUnmasteredVocabulary('a1', 10);
      expect(words.find(w => w.id === 1)?.Français).toBe('salut');
    });
  });

  describe('multi-level residency', () => {
    it('keeps a level resident after a different level is loaded, unlike the old clear-on-switch behavior', async () => {
      await db.importVocabulary(sampleEntries); // level a1
      await db.importVocabulary([
        { id: 10001, English: 'yes', Español: 'si', Français: 'oui', Category: 'basic', Class: 'adverb', level: 'a2' },
      ]);

      expect(await db.getVocabularyCountForLevel('a1')).toBe(3);
      expect(await db.getVocabularyCountForLevel('a2')).toBe(1);

      const a1Words = await db.getUnmasteredVocabulary('a1', 10);
      expect(a1Words.map(w => w.id).sort()).toEqual([1, 2, 3]);
    });

    it('clearVocabularyLevel only removes the given level, leaving others intact', async () => {
      await db.importVocabulary(sampleEntries); // level a1
      await db.importVocabulary([
        { id: 10001, English: 'yes', Español: 'si', Français: 'oui', Category: 'basic', Class: 'adverb', level: 'a2' },
      ]);

      await db.clearVocabularyLevel('a1');

      expect(await db.getVocabularyCountForLevel('a1')).toBe(0);
      expect(await db.getVocabularyCountForLevel('a2')).toBe(1);
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

    it('accumulates attempts into the rolling mastery calculation and sets masteredAt on reaching mastery', async () => {
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true);

      const progress = await db.getUserProgress(1);
      expect(progress?.masteryLevel).toBe(3);
      expect(progress?.attemptHistory).toEqual([true, true, true]);
      expect(progress?.masteredAt).toBe(progress?.lastPracticed);
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

      const unmastered = await db.getUnmasteredVocabulary('a1', 10);
      const ids = unmastered.map(w => w.id).sort();
      expect(ids).toEqual([2, 3]);
    });

    it('returns all words when none are mastered', async () => {
      await db.importVocabulary(sampleEntries);
      const unmastered = await db.getUnmasteredVocabulary('a1', 10);
      expect(unmastered).toHaveLength(3);
    });

    it('never returns words from a different level', async () => {
      await db.importVocabulary(sampleEntries); // level a1
      await db.importVocabulary([
        { id: 10001, English: 'yes', Español: 'si', Français: 'oui', Category: 'basic', Class: 'adverb', level: 'a2' },
      ]);

      const unmastered = await db.getUnmasteredVocabulary('a1', 10);
      expect(unmastered.map(w => w.id)).not.toContain(10001);
    });
  });

  describe('getMasteredVocabulary / getMasteredLevels / countMastered', () => {
    const masterWord = async (id: number) => {
      await db.saveUserProgress(id, true);
      await db.saveUserProgress(id, true);
      await db.saveUserProgress(id, true);
    };

    // saveUserProgress stamps lastPracticed from the real clock, which isn't
    // controllable enough to pin an ordering test. Insert a fully-formed
    // mastered row directly (bypassing saveUserProgress) so lastPracticed can
    // be set explicitly.
    const insertMasteredAt = async (vocabularyId: number, lastPracticed: string) => {
      const rawDb: IDBDatabase = await new Promise((resolve, reject) => {
        const request = indexedDB.open('VocabTranslatorDB');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = rawDb.transaction(['userProgress'], 'readwrite');
        tx.objectStore('userProgress').add({
          vocabularyId,
          successCount: 3,
          failCount: 0,
          currentStreak: 3,
          bestStreak: 3,
          lastPracticed,
          attemptHistory: [true, true, true],
          masteryLevel: 3,
          masteredAt: lastPracticed,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      rawDb.close();
    };

    it('orders results oldest-practiced-first, so a stale mastered word surfaces before a recently revised one', async () => {
      await db.importVocabulary(sampleEntries); // ids 1-3, level a1
      await insertMasteredAt(2, '2026-01-01T00:00:00.000Z');
      await insertMasteredAt(1, '2026-01-02T00:00:00.000Z');
      await insertMasteredAt(3, '2026-01-03T00:00:00.000Z');

      const mastered = await db.getMasteredVocabulary(['a1'], 10);
      expect(mastered.map(w => w.id)).toEqual([2, 1, 3]);
    });

    it('excludeIds advances the queue instead of repeating the same front words', async () => {
      await db.importVocabulary(sampleEntries);
      await insertMasteredAt(2, '2026-01-01T00:00:00.000Z');
      await insertMasteredAt(1, '2026-01-02T00:00:00.000Z');

      expect((await db.getMasteredVocabulary(['a1'], 1, [2])).map(w => w.id)).toEqual([1]);
    });

    it('returns only mastered, currently resident words', async () => {
      await db.importVocabulary(sampleEntries); // ids 1-3, level a1
      await masterWord(1);

      const mastered = await db.getMasteredVocabulary(['a1'], 10);
      expect(mastered.map(w => w.id)).toEqual([1]);
    });

    it('scopes to the given levels when not null', async () => {
      await db.importVocabulary(sampleEntries); // level a1
      await db.importVocabulary([
        { id: 10001, English: 'yes', Español: 'si', Français: 'oui', Category: 'basic', Class: 'adverb', level: 'a2' },
      ]);
      await masterWord(1); // a1
      await masterWord(10001); // a2

      expect((await db.getMasteredVocabulary(['a1'], 10)).map(w => w.id)).toEqual([1]);
      expect((await db.getMasteredVocabulary(null, 10)).map(w => w.id).sort()).toEqual([1, 10001]);
    });

    it('drops mastered ids whose entry is not resident (level not loaded yet)', async () => {
      // Progress for a word from a level whose entries were never imported
      // in this session - getMasteredVocabulary must skip it, not throw or
      // surface a word with missing text.
      await masterWord(20001); // b1, never imported

      expect(await db.getMasteredVocabulary(null, 10)).toEqual([]);
    });

    it('getMasteredLevels derives levels from mastered ids alone, without needing entries resident', async () => {
      await masterWord(1); // a1
      await masterWord(20001); // b1

      expect((await db.getMasteredLevels()).sort()).toEqual(['a1', 'b1']);
    });

    it('countMastered counts by level, scoped or across all levels', async () => {
      await masterWord(1); // a1
      await masterWord(2); // a1
      await masterWord(20001); // b1

      expect(await db.countMastered(['a1'])).toBe(2);
      expect(await db.countMastered(null)).toBe(3);
    });

    it('countDemoted counts words sent back to learning by a wrong answer, scoped by level', async () => {
      await masterWord(1); // a1
      await masterWord(2); // a1
      await masterWord(20001); // b1
      await db.saveUserProgress(1, false); // demotes word 1, still level a1

      expect(await db.countDemoted(['a1'])).toBe(1);
      expect(await db.countDemoted(['b1'])).toBe(0);
      expect(await db.countDemoted(null)).toBe(1);
    });

    it('countDemoted excludes a currently mastered word and a word never mastered', async () => {
      await masterWord(1); // stays mastered
      await db.saveUserProgress(2, false); // never mastered

      expect(await db.countDemoted(null)).toBe(0);
    });

    it('countDemotedToday counts a real-time demotion (happening now, so it counts as today), scoped by level', async () => {
      await masterWord(1); // a1
      await db.saveUserProgress(1, false); // demoted just now

      expect(await db.countDemotedToday(['a1'])).toBe(1);
      expect(await db.countDemotedToday(['b1'])).toBe(0);
      expect(await db.countDemotedToday(null)).toBe(1);
    });
  });

  describe('getMasteryStats', () => {
    it('scopes stats to the given level, ignoring progress from other levels', async () => {
      await db.importVocabulary(sampleEntries); // level a1, ids 1-3
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true); // word 1: mastered
      await db.saveUserProgress(20001, true); // word from a different level, should not count

      const stats = await db.getMasteryStats('a1');
      expect(stats.total).toBe(3);
      expect(stats.mastered).toBe(1);
    });

    it('returns zero percentage with no words loaded', async () => {
      const stats = await db.getMasteryStats('a1');
      expect(stats).toEqual({ total: 0, mastered: 0, percentage: 0, lifetimeWordsCorrect: 0, masteredToday: 0 });
    });

    it('counts lifetimeWordsCorrect across all levels, unlike total/mastered', async () => {
      await db.importVocabulary(sampleEntries); // level a1, ids 1-3
      await db.saveUserProgress(1, true); // this level, one success
      await db.saveUserProgress(2, false); // this level, no success yet
      await db.saveUserProgress(20001, true); // a different level entirely

      const stats = await db.getMasteryStats('a1');
      expect(stats.lifetimeWordsCorrect).toBe(2);
    });

    it('counts masteredToday across all levels, for words mastered today', async () => {
      await db.importVocabulary(sampleEntries); // level a1, ids 1-3
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(1, true); // word 1: mastered today
      await db.saveUserProgress(2, true); // word 2: not yet mastered
      await db.saveUserProgress(20001, true);
      await db.saveUserProgress(20001, true);
      await db.saveUserProgress(20001, true); // a different level, mastered today too

      const stats = await db.getMasteryStats('a1');
      expect(stats.masteredToday).toBe(2);
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
    });

    it('does not reload when the same level and version are already loaded', async () => {
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

    it('loading a second level does not clear or reload the first', async () => {
      mockFetch({ version: '1.0.0', list: [{ id: 1, spanish: 'hola' }] });
      await db.loadVocabularyFromJSON('/a1.json', 'a1');

      mockFetch({ version: '1.0.0', list: [{ id: 10001, spanish: 'si' }] });
      await db.loadVocabularyFromJSON('/a2.json', 'a2');

      expect(await db.getVocabularyCountForLevel('a1')).toBe(1);
      expect(await db.getVocabularyCountForLevel('a2')).toBe(1);
    });

    it('throws when the fetch response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, statusText: 'Not Found' }));
      await expect(db.loadVocabularyFromJSON('/missing.json', 'a1')).rejects.toThrow();
    });
  });

  describe('v6 migration', () => {
    it('backfills VocabularyEntry.level (from the id block) and UserProgress.masteredAt (from lastPracticed) on an existing v5 database', async () => {
      // Simulate an existing user's on-disk v5 data by opening the same
      // database by hand, bypassing lib/indexedDB's own schema, and writing
      // rows in the pre-migration shape: no `level` on the vocabulary
      // entry, no `masteredAt` on the mastered progress row.
      const legacyDb: IDBDatabase = await new Promise((resolve, reject) => {
        const request = indexedDB.open('VocabTranslatorDB', 5);
        request.onupgradeneeded = (event) => {
          const upgradeDb = (event.target as IDBOpenDBRequest).result;
          const vocabStore = upgradeDb.createObjectStore('vocabulary', { keyPath: 'id' });
          vocabStore.createIndex('Category', 'Category', { unique: false });
          vocabStore.createIndex('Class', 'Class', { unique: false });
          const progressStore = upgradeDb.createObjectStore('userProgress', { keyPath: 'id', autoIncrement: true });
          progressStore.createIndex('vocabularyId', 'vocabularyId', { unique: true });
          progressStore.createIndex('lastPracticed', 'lastPracticed', { unique: false });
          progressStore.createIndex('masteryLevel', 'masteryLevel', { unique: false });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      await new Promise<void>((resolve, reject) => {
        const tx = legacyDb.transaction(['vocabulary', 'userProgress'], 'readwrite');
        tx.objectStore('vocabulary').add({
          id: 10001, English: 'yes', Español: 'si', Français: 'oui', Category: 'basic', Class: 'adverb',
        });
        tx.objectStore('userProgress').add({
          vocabularyId: 10001,
          successCount: 3,
          failCount: 0,
          currentStreak: 3,
          bestStreak: 3,
          lastPracticed: '2026-01-01T00:00:00.000Z',
          attemptHistory: [true, true, true],
          masteryLevel: 3,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      legacyDb.close();

      // Any lib/indexedDB.ts call now opens the same on-disk database at the
      // current DB_VERSION, triggering the upgrade under test.
      expect(await db.getVocabularyCountForLevel('a2')).toBe(1);

      const [entry] = await db.getMasteredVocabulary(['a2'], 10);
      expect(entry).toMatchObject({ id: 10001, level: 'a2' });

      const progress = await db.getUserProgress(10001);
      expect(progress?.masteredAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('sync queue (outbox)', () => {
    it('does not enqueue an attempt when saveUserProgress is called without a syncContext (logged out)', async () => {
      await db.saveUserProgress(1, true);
      expect(await db.getSyncQueue()).toEqual([]);
    });

    it('enqueues an attempt in the same call that records progress, when logged in', async () => {
      await db.saveUserProgress(1, true, { userId: 'user-1', level: 'a1', userAnswer: 'hola' });

      const progress = await db.getUserProgress(1);
      expect(progress).not.toBeNull();

      const queue = await db.getSyncQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({
        userId: 'user-1',
        vocabularyId: 1,
        level: 'a1',
        isCorrect: true,
        userAnswer: 'hola',
      });
      expect(typeof queue[0].id).toBe('string');
      expect(queue[0].id.length).toBeGreaterThan(0);
    });

    it('queues one entry per attempt', async () => {
      // Not asserting order: the store's keyPath is a random client-generated
      // uuid, so getAll() returns key order, not insertion order. That's
      // fine — the server replays by answeredAt, not by push order.
      await db.saveUserProgress(1, true, { userId: 'user-1', level: 'a1' });
      await db.saveUserProgress(2, false, { userId: 'user-1', level: 'a1' });

      const queue = await db.getSyncQueue();
      expect(queue.map(e => e.vocabularyId).sort()).toEqual([1, 2]);
    });

    it('removeSyncQueueEntries clears only the acknowledged entries', async () => {
      await db.saveUserProgress(1, true, { userId: 'user-1', level: 'a1' });
      await db.saveUserProgress(2, true, { userId: 'user-1', level: 'a1' });

      const [first, second] = await db.getSyncQueue();
      await db.removeSyncQueueEntries([first.id]);

      const remaining = await db.getSyncQueue();
      expect(remaining.map(e => e.id)).toEqual([second.id]);
    });
  });

  describe('mergeServerProgress', () => {
    it('creates a local row for a word with no existing local progress', async () => {
      await db.mergeServerProgress([{
        vocabularyId: 5,
        successCount: 3,
        failCount: 1,
        currentStreak: 2,
        bestStreak: 2,
        attemptHistory: [true, true],
        masteryLevel: 2,
        lastPracticed: '2026-01-01T00:00:00.000Z',
      }]);

      const progress = await db.getUserProgress(5);
      expect(progress).toMatchObject({ vocabularyId: 5, successCount: 3, masteryLevel: 2 });
    });

    it('overwrites an existing local row while preserving its local autoIncrement id', async () => {
      await db.saveUserProgress(1, true); // local id 1, successCount 1
      const before = await db.getUserProgress(1);

      await db.mergeServerProgress([{
        vocabularyId: 1,
        successCount: 10,
        failCount: 2,
        currentStreak: 0,
        bestStreak: 4,
        attemptHistory: [false, false],
        masteryLevel: 0,
        lastPracticed: '2026-02-01T00:00:00.000Z',
      }]);

      const after = await db.getUserProgress(1);
      expect(after?.id).toBe(before?.id);
      expect(after).toMatchObject({ successCount: 10, failCount: 2, masteryLevel: 0 });
    });

    it('leaves local-only progress rows (not present in the server snapshot) untouched', async () => {
      await db.saveUserProgress(1, true);
      await db.saveUserProgress(2, true);

      await db.mergeServerProgress([{
        vocabularyId: 1,
        successCount: 99,
        failCount: 0,
        currentStreak: 1,
        bestStreak: 1,
        attemptHistory: [true],
        masteryLevel: 1,
        lastPracticed: '2026-01-01T00:00:00.000Z',
      }]);

      const untouched = await db.getUserProgress(2);
      expect(untouched?.successCount).toBe(1);
    });
  });

  describe('v5 -> v7 migration (sync queue)', () => {
    it('adds the syncQueue store without touching existing userProgress data', async () => {
      vi.resetModules();
      const factory = new IDBFactory();
      (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = factory;

      // Simulate a device that already has a v5 database (pre-sync-queue) with progress in it.
      await new Promise<void>((resolve, reject) => {
        const request = factory.open('VocabTranslatorDB', 5);
        request.onupgradeneeded = () => {
          const database = request.result;
          database.createObjectStore('vocabulary', { keyPath: 'id' });
          const progressStore = database.createObjectStore('userProgress', { keyPath: 'id', autoIncrement: true });
          progressStore.createIndex('vocabularyId', 'vocabularyId', { unique: true });
          progressStore.createIndex('lastPracticed', 'lastPracticed', { unique: false });
          progressStore.createIndex('masteryLevel', 'masteryLevel', { unique: false });
        };
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction('userProgress', 'readwrite');
          tx.objectStore('userProgress').add({
            vocabularyId: 42,
            successCount: 5,
            failCount: 1,
            currentStreak: 2,
            bestStreak: 3,
            lastPracticed: '2026-01-01T00:00:00.000Z',
            attemptHistory: [true, true],
            masteryLevel: 2,
          });
          tx.oncomplete = () => {
            database.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });

      const migratedDb = await import('@/lib/indexedDB');

      const preserved = await migratedDb.getUserProgress(42);
      expect(preserved).toMatchObject({ vocabularyId: 42, successCount: 5, masteryLevel: 2 });

      // The syncQueue store exists and is usable.
      expect(await migratedDb.getSyncQueue()).toEqual([]);
    });
  });

  describe('clearUserProgressAndQueue', () => {
    it('clears both userProgress and the sync queue, for an identity switch to a different account', async () => {
      await db.saveUserProgress(1, true, { userId: 'user-1', level: 'a1' });

      await db.clearUserProgressAndQueue();

      expect(await db.getUserProgress(1)).toBeNull();
      expect(await db.getSyncQueue()).toEqual([]);
    });
  });
});
