const DB_NAME = 'VocabTranslatorDB';
const DB_VERSION = 1;
const STORE_NAME = 'vocabulary';

export interface VocabularyEntry {
  id?: number;
  English: string;
  Español: string;
  Français: string;
  Category: string;
  Class: string;
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
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const getAllRequest = objectStore.getAll();

    getAllRequest.onsuccess = () => {
      const allEntries = getAllRequest.result;
      
      const shuffled = allEntries.sort(() => Math.random() - 0.5);
      const randomEntries = shuffled.slice(0, count);
      
      resolve(randomEntries);
    };

    getAllRequest.onerror = () => {
      reject(new Error('Failed to fetch vocabulary'));
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
