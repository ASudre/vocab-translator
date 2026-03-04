import { useState, useEffect, useCallback } from 'react';
import { getUnmasteredVocabulary, loadVocabularyFromJSON, VocabularyEntry, getUserProgress } from '@/lib/indexedDB';

export interface TranslationResult {
  vocabularyId: number;
  spanish: string;
  french: string;
  userAnswer?: string;
  isCorrect?: boolean | null;
  showSolution?: boolean;
  attemptHistory?: boolean[];
  progressSaved?: boolean;
}

export const useVocabularyDB = (wordCount: number = 10) => {
  const [words, setWords] = useState<TranslationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeDB = async () => {
      try {
        const lastUpdate = localStorage.getItem('vocabDB_lastUpdate');
        
        if (!lastUpdate) {
          console.log('First time loading vocabulary database...');
          await loadVocabularyFromJSON('/a1.json');
          
          const currentTimestamp = new Date().toISOString();
          localStorage.setItem('vocabDB_lastUpdate', currentTimestamp);
          console.log('DB initialized at:', currentTimestamp);
        } else {
          console.log('DB already loaded. Last update:', lastUpdate);
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize vocabulary database:', error);
      }
    };

    initializeDB();
  }, []);

  const fetchWords = useCallback(async () => {
    if (!initialized) return;
    
    setLoading(true);

    try {
      const vocabEntries = await getUnmasteredVocabulary(wordCount);

      const vocabItemsPromises = vocabEntries.map(async (item: VocabularyEntry) => {
        const progress = await getUserProgress(item.id!);
        
        return {
          vocabularyId: item.id!,
          spanish: item.Español,
          french: item.Français,
          userAnswer: '',
          isCorrect: null,
          showSolution: false,
          attemptHistory: progress?.attemptHistory || [],
          progressSaved: false
        };
      });

      const vocabItems = await Promise.all(vocabItemsPromises);
      
      setWords(prevWords => [...prevWords, ...vocabItems]);
    } catch (error) {
      console.error('Error loading vocabulary:', error);
    } finally {
      setLoading(false);
    }
  }, [wordCount, initialized]);

  useEffect(() => {
    if (initialized) {
      fetchWords();
    }
  }, [initialized, fetchWords]);

  return { words, setWords, loading, fetchWords };
};
