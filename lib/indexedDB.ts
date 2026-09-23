import {
  computeDemotedCount,
  computeDemotedToday,
  computeLifetimeWordsCorrect,
  computeMasteredToday,
  computeMasteryStats,
  computeNextProgress,
  levelForVocabularyId,
  MASTERY_THRESHOLD,
  normalizeVocabularyEntries,
  needsVocabularyReload,
  selectMastered,
  selectUnmastered,
} from './progress';
import { CEFRLevel } from './levels';

const DB_NAME = 'VocabTranslatorDB';
// 7, not 6: this app already shipped a v6 schema (level field + masteredAt
// backfill, no syncQueue) before the auth/sync feature - which independently
// needed a v6 of its own (syncQueue store, no level/masteredAt backfill) to
// land on top of a pre-v5 schema. Reusing 6 for the merged schema would mean
// onupgradeneeded never fires for anyone already sitting at either "v6" -
// IndexedDB only upgrades on a version *increase*. Bumping to 7 guarantees
// every existing installation (pre-v5, mid-session v6, or otherwise) is
// upgraded to the one true combined schema below.
const DB_VERSION = 7;
const STORE_NAME = 'vocabulary';
const PROGRESS_STORE_NAME = 'userProgress';
const SYNC_QUEUE_STORE_NAME = 'syncQueue';

export interface VocabularyEntry {
  id: number;
  English: string;
  Español: string;
  Français: string;
  Category: string;
  Class: string;
  level: CEFRLevel;
}

export interface UserProgress {
  id?: number;
  vocabularyId: number;
  successCount: number;
  failCount: number;
  bestStreak: number;
  currentStreak: number;
  lastPracticed: string;
  attemptHistory: boolean[];
  masteryLevel: number;
  /** Set only on the transition into MASTERY_THRESHOLD; see lib/progress.ts. */
  masteredAt?: string;
  /** Set only on the transition out of MASTERY_THRESHOLD (a revision miss); see lib/progress.ts. */
  demotedAt?: string;
}

/**
 * One answered word queued for the server. `id` is a client-generated uuid
 * that also serves as the attempt's id, so a retried push is idempotent
 * server-side. Only created while logged in (see saveUserProgress).
 */
export interface SyncQueueEntry {
  id: string;
  userId: string;
  vocabularyId: number;
  level: string;
  isCorrect: boolean;
  userAnswer: string | null;
  answeredAt: string;
}

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message || 'unknown error'}`));
    };

    // A version bump can't apply while another tab still has an older
    // connection open; without this, that tab's open() request would hang
    // forever instead of settling.
    request.onblocked = () => {
      reject(new Error('IndexedDB upgrade is blocked by another open connection (close other tabs and retry)'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      // A later version bump from another tab invalidates this connection;
      // close it so that tab's upgrade can proceed instead of blocking forever.
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction!;
      const oldVersion = event.oldVersion;

      const recreateVocabStore = (): IDBObjectStore => {
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('Category', 'Category', { unique: false });
        store.createIndex('Class', 'Class', { unique: false });
        store.createIndex('level', 'level', { unique: false });
        return store;
      };

      if (oldVersion === 0) {
        recreateVocabStore();
      } else if (oldVersion < 5) {
        // Migration for version 5: recreate vocabulary store to remove auto-increment.
        // User progress is preserved since vocabulary order remains the same (IDs will match)
        recreateVocabStore();
        console.log('Vocabulary store migrated to use stable IDs from JSON');
      } else if (oldVersion < 6) {
        // Entries from before the store kept every visited level resident at
        // once (instead of clearing on level switch) predate the `level`
        // field; recover it from the id block (see levelForVocabularyId)
        // rather than losing the cached data.
        const vocabStore = tx.objectStore(STORE_NAME);
        if (!vocabStore.indexNames.contains('level')) {
          vocabStore.createIndex('level', 'level', { unique: false });
        }
        vocabStore.openCursor().onsuccess = (cursorEvent) => {
          const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (!cursor) return;
          const entry = cursor.value as VocabularyEntry;
          if (!entry.level) {
            cursor.update({ ...entry, level: levelForVocabularyId(entry.id) });
          }
          cursor.continue();
        };
      }

      if (!db.objectStoreNames.contains(PROGRESS_STORE_NAME)) {
        const progressStore = db.createObjectStore(PROGRESS_STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });

        progressStore.createIndex('vocabularyId', 'vocabularyId', { unique: true });
        progressStore.createIndex('lastPracticed', 'lastPracticed', { unique: false });
        progressStore.createIndex('masteryLevel', 'masteryLevel', { unique: false });
      } else {
        const progressStore = tx.objectStore(PROGRESS_STORE_NAME);

        if (oldVersion < 4) {
          if (progressStore.indexNames.contains('isMastered')) {
            progressStore.deleteIndex('isMastered');
          }

          if (!progressStore.indexNames.contains('masteryLevel')) {
            progressStore.createIndex('masteryLevel', 'masteryLevel', { unique: false });
          }
        }

        if (oldVersion > 0 && oldVersion < 6) {
          // masteredAt marks the moment a word most recently transitioned
          // into mastery (see lib/progress.ts). Under the invariant that
          // held before this field existed, a word reached mastery exactly
          // once, so lastPracticed at that moment IS the mastery moment -
          // backfill it exactly, not as a heuristic.
          progressStore.openCursor().onsuccess = (cursorEvent) => {
            const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (!cursor) return;
            const progress = cursor.value as UserProgress;
            if (progress.masteryLevel === MASTERY_THRESHOLD && !progress.masteredAt) {
              cursor.update({ ...progress, masteredAt: progress.lastPracticed });
            }
            cursor.continue();
          };
        }
      }

      // Unconditional (not gated on oldVersion): correct for every upgrade
      // path precisely because DB_VERSION's bump to 7 guarantees this
      // handler runs at least once for anyone who doesn't have it yet.
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE_NAME)) {
        db.createObjectStore(SYNC_QUEUE_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const importVocabulary = async (data: VocabularyEntry[]): Promise<void> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => {
      console.log(`Successfully imported ${data.length} vocabulary entries`);
      resolve();
    };

    transaction.onerror = () => {
      reject(new Error('Failed to import vocabulary'));
    };

    // put (not add): levels loaded more than once (e.g. a version bump) must
    // overwrite in place now that the store isn't cleared before every load.
    data.forEach(entry => {
      objectStore.put(entry);
    });
  });
};

export const getVocabularyCount = async (): Promise<number> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const countRequest = objectStore.count();

    countRequest.onsuccess = () => {
      resolve(countRequest.result);
    };

    countRequest.onerror = () => {
      reject(new Error('Failed to count vocabulary entries'));
    };
  });
};

export const getVocabularyCountForLevel = async (level: CEFRLevel): Promise<number> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const levelIndex = transaction.objectStore(STORE_NAME).index('level');
    const countRequest = levelIndex.count(IDBKeyRange.only(level));

    countRequest.onsuccess = () => {
      resolve(countRequest.result);
    };

    countRequest.onerror = () => {
      reject(new Error('Failed to count vocabulary entries for level'));
    };
  });
};

export const getUnmasteredVocabulary = async (level: CEFRLevel, count: number): Promise<VocabularyEntry[]> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, PROGRESS_STORE_NAME], 'readonly');
    const vocabStore = transaction.objectStore(STORE_NAME);
    const progressStore = transaction.objectStore(PROGRESS_STORE_NAME);
    const masteryIndex = progressStore.index('masteryLevel');
    const levelIndex = vocabStore.index('level');

    const masteredRequest = masteryIndex.getAll(IDBKeyRange.only(MASTERY_THRESHOLD));

    masteredRequest.onsuccess = () => {
      const masteredProgress = masteredRequest.result as UserProgress[];
      const masteredVocabIds = new Set(masteredProgress.map(p => p.vocabularyId));

      const getLevelVocabRequest = levelIndex.getAll(IDBKeyRange.only(level));

      getLevelVocabRequest.onsuccess = () => {
        const levelVocab = getLevelVocabRequest.result as VocabularyEntry[];
        const selected = selectUnmastered(levelVocab, masteredVocabIds, count);

        resolve(selected);
      };

      getLevelVocabRequest.onerror = () => {
        reject(new Error('Failed to fetch vocabulary'));
      };
    };

    masteredRequest.onerror = () => {
      reject(new Error('Failed to fetch mastered vocabulary'));
    };
  });
};

/**
 * Mastered words available for revision, oldest-practiced-first (see
 * selectMastered). `levels === null` pools across every CEFR level the user
 * has ever mastered a word in; otherwise the pool is restricted to the given
 * levels. `excludeIds` (words already served this session) is filtered out
 * before ordering, so repeated calls advance through the queue instead of
 * returning the same stale front of the line every time. Progress can
 * outlive its entry's residency (a mastered level not (re)loaded yet this
 * session) - such ids are simply dropped rather than surfaced with missing
 * text.
 */
export const getMasteredVocabulary = async (
  levels: CEFRLevel[] | null,
  count: number,
  excludeIds: number[] = []
): Promise<VocabularyEntry[]> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, PROGRESS_STORE_NAME], 'readonly');
    const vocabStore = transaction.objectStore(STORE_NAME);
    const progressStore = transaction.objectStore(PROGRESS_STORE_NAME);
    const masteryIndex = progressStore.index('masteryLevel');

    const masteredRequest = masteryIndex.getAll(IDBKeyRange.only(MASTERY_THRESHOLD));

    masteredRequest.onsuccess = () => {
      const excluded = new Set(excludeIds);
      const masteredProgress = (masteredRequest.result as UserProgress[])
        .filter(p => !excluded.has(p.vocabularyId));

      if (masteredProgress.length === 0) {
        resolve([]);
        return;
      }

      const getAllVocabRequest = vocabStore.getAll();

      getAllVocabRequest.onsuccess = () => {
        const allVocab = (getAllVocabRequest.result as VocabularyEntry[])
          .filter(entry => levels === null || levels.includes(entry.level));

        resolve(selectMastered(allVocab, masteredProgress, count));
      };

      getAllVocabRequest.onerror = () => {
        reject(new Error('Failed to fetch vocabulary'));
      };
    };

    masteredRequest.onerror = () => {
      reject(new Error('Failed to fetch mastered vocabulary'));
    };
  });
};

/** Every CEFR level the user has mastered at least one word in, derived from ids alone (no entry residency required). */
export const getMasteredLevels = async (): Promise<CEFRLevel[]> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROGRESS_STORE_NAME], 'readonly');
    const masteryIndex = transaction.objectStore(PROGRESS_STORE_NAME).index('masteryLevel');
    const request = masteryIndex.getAll(IDBKeyRange.only(MASTERY_THRESHOLD));

    request.onsuccess = () => {
      const masteredProgress = request.result as UserProgress[];
      const levels = new Set(masteredProgress.map(p => levelForVocabularyId(p.vocabularyId)));
      resolve([...levels]);
    };

    request.onerror = () => {
      reject(new Error('Failed to fetch mastered levels'));
    };
  });
};

/** Count of mastered words in scope, for the revision page's "master N words first" gate. */
export const countMastered = async (levels: CEFRLevel[] | null): Promise<number> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROGRESS_STORE_NAME], 'readonly');
    const masteryIndex = transaction.objectStore(PROGRESS_STORE_NAME).index('masteryLevel');
    const request = masteryIndex.getAll(IDBKeyRange.only(MASTERY_THRESHOLD));

    request.onsuccess = () => {
      const masteredProgress = request.result as UserProgress[];
      const count = levels === null
        ? masteredProgress.length
        : masteredProgress.filter(p => levels.includes(levelForVocabularyId(p.vocabularyId))).length;
      resolve(count);
    };

    request.onerror = () => {
      reject(new Error('Failed to count mastered vocabulary'));
    };
  });
};

/** Count of words currently below mastery that were mastered before - i.e. sent back to learning by a revision wrong answer. */
export const countDemoted = async (levels: CEFRLevel[] | null): Promise<number> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROGRESS_STORE_NAME], 'readonly');
    const request = transaction.objectStore(PROGRESS_STORE_NAME).getAll();

    request.onsuccess = () => {
      resolve(computeDemotedCount(request.result as UserProgress[], levels));
    };

    request.onerror = () => {
      reject(new Error('Failed to count demoted vocabulary'));
    };
  });
};

/** Count of words demoted (sent back to learning) specifically today. */
export const countDemotedToday = async (levels: CEFRLevel[] | null): Promise<number> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROGRESS_STORE_NAME], 'readonly');
    const request = transaction.objectStore(PROGRESS_STORE_NAME).getAll();

    request.onsuccess = () => {
      resolve(computeDemotedToday(request.result as UserProgress[], new Date(), levels));
    };

    request.onerror = () => {
      reject(new Error('Failed to count words demoted today'));
    };
  });
};

export const clearVocabulary = async (): Promise<void> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const clearRequest = objectStore.clear();

    clearRequest.onsuccess = () => {
      console.log('Vocabulary cleared');
      resolve();
    };

    clearRequest.onerror = () => {
      reject(new Error('Failed to clear vocabulary'));
    };
  });
};

export const clearVocabularyLevel = async (level: CEFRLevel): Promise<void> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const levelIndex = transaction.objectStore(STORE_NAME).index('level');
    const cursorRequest = levelIndex.openCursor(IDBKeyRange.only(level));

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Failed to clear vocabulary level'));
  });
};

/**
 * Force reload one level's vocabulary from JSON, clearing only that level.
 */
export const forceReloadVocabulary = async (jsonPath: string, level: CEFRLevel): Promise<void> => {
  try {
    console.log(`Force reloading vocabulary level ${level}...`);

    await clearVocabularyLevel(level);
    localStorage.removeItem(`vocabDB_version_${level}`);
    await loadVocabularyFromJSON(jsonPath, level);

    console.log('Vocabulary force reloaded successfully');
  } catch (error) {
    console.error('Error force reloading vocabulary:', error);
    throw error;
  }
};

export const loadVocabularyFromJSON = async (jsonPath: string, level: CEFRLevel): Promise<void> => {
  try {
    console.log('Checking vocabulary version...');
    const response = await fetch(jsonPath);

    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.statusText}`);
    }

    const jsonData = await response.json();
    const jsonVersion = jsonData.version || '1.0.0';
    const storedVersion = localStorage.getItem(`vocabDB_version_${level}`);

    // Scoped to this level alone: the store now keeps every visited level
    // resident at once, so another level being loaded must not block or
    // clear this one.
    const levelCount = await getVocabularyCountForLevel(level);
    const needsReload = needsVocabularyReload({ levelCount, storedVersion, jsonVersion });

    if (!needsReload) {
      console.log(`Vocabulary already loaded (level ${level}, version ${storedVersion})`);
      return;
    }

    if (levelCount > 0) {
      console.log(`Reloading level ${level} (version ${storedVersion} → ${jsonVersion})...`);
      await clearVocabularyLevel(level);
    } else {
      console.log(`Loading vocabulary level ${level}, version ${jsonVersion}...`);
    }

    const data: VocabularyEntry[] = normalizeVocabularyEntries(jsonData, level);

    await importVocabulary(data);

    localStorage.setItem(`vocabDB_version_${level}`, jsonVersion);

    console.log(`Vocabulary level ${level} (version ${jsonVersion}) successfully loaded into IndexedDB`);
  } catch (error) {
    console.error('Error loading vocabulary from JSON:', error);
    throw error;
  }
};

export const getUserProgress = async (vocabularyId: number): Promise<UserProgress | null> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROGRESS_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(PROGRESS_STORE_NAME);
    const index = objectStore.index('vocabularyId');
    const getRequest = index.get(vocabularyId);

    getRequest.onsuccess = () => {
      resolve(getRequest.result || null);
    };

    getRequest.onerror = () => {
      reject(new Error('Failed to get user progress'));
    };
  });
};

/** Context needed to also queue this attempt for the server. Omit while logged out. */
export interface SyncContext {
  userId: string;
  level: string;
  userAnswer?: string;
}

export const saveUserProgress = async (
  vocabularyId: number,
  isCorrect: boolean,
  syncContext?: SyncContext | null
): Promise<void> => {
  const db = await initDB();
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const storeNames = syncContext ? [PROGRESS_STORE_NAME, SYNC_QUEUE_STORE_NAME] : [PROGRESS_STORE_NAME];
    const transaction = db.transaction(storeNames, 'readwrite');
    const objectStore = transaction.objectStore(PROGRESS_STORE_NAME);
    const index = objectStore.index('vocabularyId');
    const getRequest = index.get(vocabularyId);

    getRequest.onsuccess = () => {
      const existingProgress = getRequest.result as UserProgress | undefined;

      const progressData: UserProgress = {
        ...computeNextProgress(existingProgress, isCorrect, now),
        vocabularyId,
      };

      if (existingProgress) {
        objectStore.put(progressData);
      } else {
        objectStore.add(progressData);
      }

      // Enqueued in the same transaction as the progress write so an
      // attempt can never be recorded locally without also being queued
      // for the server.
      if (syncContext) {
        const queueEntry: SyncQueueEntry = {
          id: crypto.randomUUID(),
          userId: syncContext.userId,
          vocabularyId,
          level: syncContext.level,
          isCorrect,
          userAnswer: syncContext.userAnswer ?? null,
          answeredAt: now,
        };
        transaction.objectStore(SYNC_QUEUE_STORE_NAME).add(queueEntry);
      }
    };

    getRequest.onerror = () => {
      reject(new Error('Failed to check existing progress'));
    };

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = (error) => {
      console.error('Error saving user progress:', error);
      reject(new Error('Failed to save user progress'));
    };
  });
};

export const getAllUserProgress = async (): Promise<UserProgress[]> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROGRESS_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(PROGRESS_STORE_NAME);
    const getAllRequest = objectStore.getAll();

    getAllRequest.onsuccess = () => {
      resolve(getAllRequest.result);
    };

    getAllRequest.onerror = () => {
      reject(new Error('Failed to get all user progress'));
    };
  });
};

export const getMasteryStats = async (level: CEFRLevel): Promise<{ total: number; mastered: number; percentage: number; lifetimeWordsCorrect: number; masteredToday: number }> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, PROGRESS_STORE_NAME], 'readonly');
    const vocabStore = transaction.objectStore(STORE_NAME);
    const progressStore = transaction.objectStore(PROGRESS_STORE_NAME);
    const levelIndex = vocabStore.index('level');

    // The progress store accumulates records across every level ever
    // practiced (it's never cleared), while total/mastered below must be
    // scoped to this level's ids alone.
    const getLevelKeysRequest = levelIndex.getAllKeys(IDBKeyRange.only(level));

    getLevelKeysRequest.onsuccess = () => {
      const currentLevelIds = new Set(getLevelKeysRequest.result as number[]);

      const getAllProgressRequest = progressStore.getAll();

      getAllProgressRequest.onsuccess = () => {
        const allProgress = getAllProgressRequest.result as UserProgress[];
        resolve({
          ...computeMasteryStats(currentLevelIds, allProgress),
          lifetimeWordsCorrect: computeLifetimeWordsCorrect(allProgress),
          masteredToday: computeMasteredToday(allProgress),
        });
      };

      getAllProgressRequest.onerror = () => {
        reject(new Error('Failed to get progress data'));
      };
    };

    getLevelKeysRequest.onerror = () => {
      reject(new Error('Failed to get vocabulary ids'));
    };
  });
};

export const getSyncQueue = async (): Promise<SyncQueueEntry[]> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE_NAME], 'readonly');
    const getAllRequest = transaction.objectStore(SYNC_QUEUE_STORE_NAME).getAll();

    getAllRequest.onsuccess = () => resolve(getAllRequest.result);
    getAllRequest.onerror = () => reject(new Error('Failed to read sync queue'));
  });
};

/** Removes acknowledged entries once the server has confirmed it stored them. */
export const removeSyncQueueEntries = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(SYNC_QUEUE_STORE_NAME);
    ids.forEach(id => objectStore.delete(id));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Failed to clear synced queue entries'));
  });
};

/**
 * Merges a server progress snapshot into IndexedDB: server rows win for
 * words the server knows about, local-only rows are left untouched (they
 * get re-offered as baseline on the next sync — see hooks/useSync.ts).
 * Looks up by the vocabularyId index rather than inventing an `id`, since
 * that index is unique and the store's autoIncrement `id` is local-only.
 */
export const mergeServerProgress = async (rows: Omit<UserProgress, 'id'>[]): Promise<void> => {
  if (rows.length === 0) return;
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROGRESS_STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(PROGRESS_STORE_NAME);
    const index = objectStore.index('vocabularyId');

    rows.forEach(row => {
      const getRequest = index.get(row.vocabularyId);
      getRequest.onsuccess = () => {
        const existing = getRequest.result as UserProgress | undefined;
        if (existing) {
          objectStore.put({ ...row, id: existing.id });
        } else {
          objectStore.add(row);
        }
      };
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Failed to merge server progress'));
  });
};

/**
 * Called when a different account logs in on this device: the previous
 * account's local progress must not leak into the new account's view.
 */
export const clearUserProgressAndQueue = async (): Promise<void> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROGRESS_STORE_NAME, SYNC_QUEUE_STORE_NAME], 'readwrite');
    transaction.objectStore(PROGRESS_STORE_NAME).clear();
    transaction.objectStore(SYNC_QUEUE_STORE_NAME).clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Failed to clear local progress'));
  });
};
