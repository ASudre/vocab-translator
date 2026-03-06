import { useState, useEffect, useCallback } from 'react';
import { getUnmasteredVocabulary, loadVocabularyFromJSON, VocabularyEntry, getUserProgress } from '@/lib/indexedDB';

export interface TranslationResult {
  vocabularyId: number;
  spanish: string;
  french: string;
  class: string;
  category: string;
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
        await loadVocabularyFromJSON('/a1.json');
        
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
          class: item.Class,
          category: item.Category,
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
