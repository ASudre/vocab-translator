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
    
    const masteredRequest = masteryIndex.getAll(IDBKeyRange.only(3));
    
    masteredRequest.onsuccess = () => {
      const masteredProgress = masteredRequest.result as UserProgress[];
      const masteredVocabIds = new Set(masteredProgress.map(p => p.vocabularyId));
      
      const getAllVocabRequest = vocabStore.getAll();
      
      getAllVocabRequest.onsuccess = () => {
        const allVocab = getAllVocabRequest.result as VocabularyEntry[];
        const unmastered = allVocab.filter(vocab => !masteredVocabIds.has(vocab.id!));
        
        const shuffled = unmastered.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, count);
        
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
export const forceReloadVocabulary = async (jsonPath: string): Promise<void> => {
  try {
    console.log('Force reloading vocabulary...');
    
    // Clear existing vocabulary
    await clearVocabulary();
    
    // Clear the lastUpdate flag
    localStorage.removeItem('vocabDB_lastUpdate');
    
    // Reload from JSON
    await loadVocabularyFromJSON(jsonPath);
    
    console.log('Vocabulary force reloaded successfully');
  } catch (error) {
    console.error('Error force reloading vocabulary:', error);
    throw error;
  }
};

export const loadVocabularyFromJSON = async (jsonPath: string): Promise<void> => {
  try {
    console.log('Checking vocabulary version...');
    const response = await fetch(jsonPath);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.statusText}`);
    }
    
    const jsonData = await response.json();
    const jsonVersion = jsonData.version || '1.0.0';
    const storedVersion = localStorage.getItem('vocabDB_version');
    
    // Check if we need to reload
    const count = await getVocabularyCount();
    const needsReload = storedVersion !== jsonVersion;
    
    if (count > 0 && !needsReload) {
      console.log(`Vocabulary already loaded (version ${storedVersion})`);
      return;
    }
    
    if (needsReload && count > 0) {
      console.log(`Version changed: ${storedVersion} → ${jsonVersion}. Reloading vocabulary...`);
      await clearVocabulary();
    } else {
      console.log(`Loading vocabulary version ${jsonVersion}...`);
    }
    
    // Handle both formats: { list: [...] } or direct array
    const rawData = Array.isArray(jsonData) ? jsonData : jsonData.list;
    
    // Normalize the data to VocabularyEntry format
    const data: VocabularyEntry[] = rawData.map((entry: {
      id: number;
      spanish?: string;
      Español?: string;
      english?: string;
      English?: string;
      french?: string;
      Français?: string;
      category?: string;
      Category?: string;
      class?: string;
      Class?: string;
    }) => ({
      id: entry.id,
      English: entry.english || entry.English || '',
      Español: entry.spanish || entry.Español || '',
      Français: entry.french || entry.Français || '',
      Category: entry.category || entry.Category || '',
      Class: entry.class || entry.Class || '',
    }));
    
    await importVocabulary(data);
    
    // Store the version
    localStorage.setItem('vocabDB_version', jsonVersion);
    
    console.log(`Vocabulary version ${jsonVersion} successfully loaded into IndexedDB`);
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
      
      let progressData: UserProgress;

      if (existingProgress) {
        const newCurrentStreak = isCorrect ? existingProgress.currentStreak + 1 : 0;
        const newBestStreak = Math.max(existingProgress.bestStreak, newCurrentStreak);
        
        const newAttemptHistory = [...(existingProgress.attemptHistory || []), isCorrect].slice(-3);
        
        // Calculate masteryLevel: count consecutive successes from the end (0-3)
        let masteryLevel = 0;
        for (let i = newAttemptHistory.length - 1; i >= 0; i--) {
          if (newAttemptHistory[i] === true) {
            masteryLevel++;
          } else {
            break;
          }
        }

        progressData = {
          id: existingProgress.id,
          vocabularyId: existingProgress.vocabularyId,
          successCount: existingProgress.successCount + (isCorrect ? 1 : 0),
          failCount: existingProgress.failCount + (isCorrect ? 0 : 1),
          currentStreak: newCurrentStreak,
          bestStreak: newBestStreak,
          lastPracticed: new Date().toISOString(),
          attemptHistory: newAttemptHistory,
          masteryLevel
        };

        objectStore.put(progressData);
      } else {
        const masteryLevel = isCorrect ? 1 : 0;

        progressData = {
          vocabularyId,
          successCount: isCorrect ? 1 : 0,
          failCount: isCorrect ? 0 : 1,
          currentStreak: isCorrect ? 1 : 0,
          bestStreak: isCorrect ? 1 : 0,
          lastPracticed: new Date().toISOString(),
          attemptHistory: [isCorrect],
          masteryLevel
        };

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
    
    const countRequest = vocabStore.count();
    
    countRequest.onsuccess = () => {
      const totalWords = countRequest.result;
      
      const getAllProgressRequest = progressStore.getAll();
      
      getAllProgressRequest.onsuccess = () => {
        const allProgress = getAllProgressRequest.result as UserProgress[];
        
        // Sum all mastery levels (0-3 per word)
        const totalMasteryPoints = allProgress.reduce((sum, progress) => sum + (progress.masteryLevel || 0), 0);
        
        // Count words with masteryLevel = 3
        const masteredWords = allProgress.filter(p => p.masteryLevel === 3).length;
        
        // Maximum possible points: totalWords * 3
        const maxPoints = totalWords * 3;
        const percentage = maxPoints > 0 ? Math.round((totalMasteryPoints / maxPoints) * 1000) / 10 : 0;
        
        resolve({
          total: totalWords,
          mastered: masteredWords,
          percentage
        });
      };
      
      getAllProgressRequest.onerror = () => {
        reject(new Error('Failed to get progress data'));
      };
    };
    
    countRequest.onerror = () => {
      reject(new Error('Failed to count total words'));
    };
  });
};
