import { computeMasteryStats, computeNextProgress, MASTERY_THRESHOLD, normalizeVocabularyEntries, needsVocabularyReload, selectUnmastered } from './progress';

const DB_NAME = 'VocabTranslatorDB';
const DB_VERSION = 5;
const STORE_NAME = 'vocabulary';
const PROGRESS_STORE_NAME = 'userProgress';

export interface VocabularyEntry {
  id: number;
  English: string;
  Español: string;
  Français: string;
  Category: string;
  Class: string;
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
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { 
          keyPath: 'id'
        });
        
        objectStore.createIndex('Category', 'Category', { unique: false });
        objectStore.createIndex('Class', 'Class', { unique: false });
      }
      
      // Migration for version 5: recreate vocabulary store to remove auto-increment
      // User progress is preserved since vocabulary order remains the same (IDs will match)
      if (db.objectStoreNames.contains(STORE_NAME) && event.oldVersion < 5) {
        db.deleteObjectStore(STORE_NAME);
        const objectStore = db.createObjectStore(STORE_NAME, { 
          keyPath: 'id'
        });
        
        objectStore.createIndex('Category', 'Category', { unique: false });
        objectStore.createIndex('Class', 'Class', { unique: false });
        
        console.log('Vocabulary store migrated to use stable IDs from JSON');
      }

      if (!db.objectStoreNames.contains(PROGRESS_STORE_NAME)) {
        const progressStore = db.createObjectStore(PROGRESS_STORE_NAME, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        
        progressStore.createIndex('vocabularyId', 'vocabularyId', { unique: true });
        progressStore.createIndex('lastPracticed', 'lastPracticed', { unique: false });
        progressStore.createIndex('masteryLevel', 'masteryLevel', { unique: false });
      }
      
      if (db.objectStoreNames.contains(PROGRESS_STORE_NAME) && event.oldVersion < 4) {
        const tx = (event.target as IDBOpenDBRequest).transaction!;
        const progressStore = tx.objectStore(PROGRESS_STORE_NAME);
        
        if (progressStore.indexNames.contains('isMastered')) {
          progressStore.deleteIndex('isMastered');
        }
        
        if (!progressStore.indexNames.contains('masteryLevel')) {
          progressStore.createIndex('masteryLevel', 'masteryLevel', { unique: false });
        }
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

    data.forEach(entry => {
      objectStore.add(entry);
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

export const getUnmasteredVocabulary = async (count: number): Promise<VocabularyEntry[]> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, PROGRESS_STORE_NAME], 'readonly');
    const vocabStore = transaction.objectStore(STORE_NAME);
    const progressStore = transaction.objectStore(PROGRESS_STORE_NAME);
    const masteryIndex = progressStore.index('masteryLevel');
    
    const masteredRequest = masteryIndex.getAll(IDBKeyRange.only(MASTERY_THRESHOLD));
    
    masteredRequest.onsuccess = () => {
      const masteredProgress = masteredRequest.result as UserProgress[];
      const masteredVocabIds = new Set(masteredProgress.map(p => p.vocabularyId));
      
      const getAllVocabRequest = vocabStore.getAll();
      
      getAllVocabRequest.onsuccess = () => {
        const allVocab = getAllVocabRequest.result as VocabularyEntry[];
        const selected = selectUnmastered(allVocab, masteredVocabIds, count);

        resolve(selected);
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

/**
 * Force reload vocabulary from JSON
 * Clears existing vocabulary and reloads from the JSON file
 */
export const forceReloadVocabulary = async (jsonPath: string, level: string): Promise<void> => {
  try {
    console.log('Force reloading vocabulary...');

    // Clear existing vocabulary
    await clearVocabulary();

    // Clear the lastUpdate flag
    localStorage.removeItem('vocabDB_lastUpdate');

    // Reload from JSON
    await loadVocabularyFromJSON(jsonPath, level);
    
    console.log('Vocabulary force reloaded successfully');
  } catch (error) {
    console.error('Error force reloading vocabulary:', error);
    throw error;
  }
};

export const loadVocabularyFromJSON = async (jsonPath: string, level: string): Promise<void> => {
  try {
    console.log('Checking vocabulary version...');
    const response = await fetch(jsonPath);

    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.statusText}`);
    }

    const jsonData = await response.json();
    const jsonVersion = jsonData.version || '1.0.0';
    const storedVersion = localStorage.getItem(`vocabDB_version_${level}`);
    const activeLevel = localStorage.getItem('vocabDB_activeLevel');

    // Check if we need to reload: level switched, or this level's data changed
    const count = await getVocabularyCount();
    const needsReload = needsVocabularyReload({ count, activeLevel, level, storedVersion, jsonVersion });

    if (!needsReload) {
      console.log(`Vocabulary already loaded (level ${level}, version ${storedVersion})`);
      return;
    }

    if (count > 0) {
      console.log(`Loading level ${level} (was ${activeLevel}, version ${storedVersion} → ${jsonVersion}). Reloading vocabulary...`);
      await clearVocabulary();
    } else {
      console.log(`Loading vocabulary level ${level}, version ${jsonVersion}...`);
    }

    const data: VocabularyEntry[] = normalizeVocabularyEntries(jsonData);

    await importVocabulary(data);

    // Store the version and active level
    localStorage.setItem(`vocabDB_version_${level}`, jsonVersion);
    localStorage.setItem('vocabDB_activeLevel', level);

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

export const saveUserProgress = async (vocabularyId: number, isCorrect: boolean): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROGRESS_STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(PROGRESS_STORE_NAME);
    const index = objectStore.index('vocabularyId');
    const getRequest = index.get(vocabularyId);

    getRequest.onsuccess = () => {
      const existingProgress = getRequest.result as UserProgress | undefined;

      const progressData: UserProgress = {
        ...computeNextProgress(existingProgress, isCorrect, new Date().toISOString()),
        vocabularyId,
      };

      if (existingProgress) {
        objectStore.put(progressData);
      } else {
        objectStore.add(progressData);
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

export const getMasteryStats = async (): Promise<{ total: number; mastered: number; percentage: number }> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, PROGRESS_STORE_NAME], 'readonly');
    const vocabStore = transaction.objectStore(STORE_NAME);
    const progressStore = transaction.objectStore(PROGRESS_STORE_NAME);

    // The progress store accumulates records across every level ever
    // practiced (it's never cleared on level switch), while vocabStore only
    // holds the currently loaded level's words. Get this level's ids so
    // progress from other levels doesn't leak into its stats.
    const getAllKeysRequest = vocabStore.getAllKeys();

    getAllKeysRequest.onsuccess = () => {
      const currentLevelIds = new Set(getAllKeysRequest.result as number[]);

      const getAllProgressRequest = progressStore.getAll();

      getAllProgressRequest.onsuccess = () => {
        const allProgress = getAllProgressRequest.result as UserProgress[];
        resolve(computeMasteryStats(currentLevelIds, allProgress));
      };

      getAllProgressRequest.onerror = () => {
        reject(new Error('Failed to get progress data'));
      };
    };

    getAllKeysRequest.onerror = () => {
      reject(new Error('Failed to get vocabulary ids'));
    };
  });
};
