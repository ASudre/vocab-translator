const DB_NAME = 'VocabTranslatorDB';
const DB_VERSION = 3;
const STORE_NAME = 'vocabulary';
const PROGRESS_STORE_NAME = 'userProgress';

export interface VocabularyEntry {
  id?: number;
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
  isMastered: number;
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
          keyPath: 'id', 
          autoIncrement: true 
        });
        
        objectStore.createIndex('Category', 'Category', { unique: false });
        objectStore.createIndex('Class', 'Class', { unique: false });
      }

      if (!db.objectStoreNames.contains(PROGRESS_STORE_NAME)) {
        const progressStore = db.createObjectStore(PROGRESS_STORE_NAME, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        
        progressStore.createIndex('vocabularyId', 'vocabularyId', { unique: true });
        progressStore.createIndex('lastPracticed', 'lastPracticed', { unique: false });
        progressStore.createIndex('isMastered', 'isMastered', { unique: false });
      }
      
      if (db.objectStoreNames.contains(PROGRESS_STORE_NAME) && event.oldVersion < 3) {
        const tx = (event.target as IDBOpenDBRequest).transaction!;
        const progressStore = tx.objectStore(PROGRESS_STORE_NAME);
        if (!progressStore.indexNames.contains('isMastered')) {
          progressStore.createIndex('isMastered', 'isMastered', { unique: false });
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

export const getRandomVocabulary = async (count: number): Promise<VocabularyEntry[]> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, PROGRESS_STORE_NAME], 'readonly');
    const vocabStore = transaction.objectStore(STORE_NAME);
    const progressStore = transaction.objectStore(PROGRESS_STORE_NAME);
    const masteredIndex = progressStore.index('isMastered');
    
    const masteredRequest = masteredIndex.getAll(IDBKeyRange.only(1));
    
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

export const loadVocabularyFromJSON = async (jsonPath: string): Promise<void> => {
  try {
    const count = await getVocabularyCount();
    
    if (count > 0) {
      console.log('Vocabulary already loaded in IndexedDB');
      return;
    }

    console.log('Loading vocabulary from JSON...');
    const response = await fetch(jsonPath);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.statusText}`);
    }
    
    const data: VocabularyEntry[] = await response.json();
    await importVocabulary(data);
    console.log('Vocabulary successfully loaded into IndexedDB');
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
        const isMastered = (newAttemptHistory.length >= 3 && newAttemptHistory.every(attempt => attempt === true)) ? 1 : 0;

        progressData = {
          id: existingProgress.id,
          vocabularyId: existingProgress.vocabularyId,
          successCount: existingProgress.successCount + (isCorrect ? 1 : 0),
          failCount: existingProgress.failCount + (isCorrect ? 0 : 1),
          currentStreak: newCurrentStreak,
          bestStreak: newBestStreak,
          lastPracticed: new Date().toISOString(),
          attemptHistory: newAttemptHistory,
          isMastered
        };

        objectStore.put(progressData);
      } else {
        const isMastered = isCorrect ? 1 : 0;

        progressData = {
          vocabularyId,
          successCount: isCorrect ? 1 : 0,
          failCount: isCorrect ? 0 : 1,
          currentStreak: isCorrect ? 1 : 0,
          bestStreak: isCorrect ? 1 : 0,
          lastPracticed: new Date().toISOString(),
          attemptHistory: [isCorrect],
          isMastered
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
