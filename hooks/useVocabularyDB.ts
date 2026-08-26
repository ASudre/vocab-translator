import { useState, useEffect, useCallback } from 'react';
import { getUnmasteredVocabulary, loadVocabularyFromJSON, VocabularyEntry, getUserProgress } from '@/lib/indexedDB';

export const CEFR_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'] as const;
export type CEFRLevel = (typeof CEFR_LEVELS)[number];

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

export const useVocabularyDB = (level: CEFRLevel, wordCount: number = 10, enabled: boolean = true) => {
  const [words, setWords] = useState<TranslationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Skip until the caller has settled on the real starting level (e.g.
    // after restoring it from localStorage) — otherwise a default level's
    // load can race a subsequent level switch and corrupt IndexedDB, since
    // both hit the same shared vocabulary store concurrently.
    if (!enabled) return;

    let cancelled = false;
    setInitialized(false);
    setWords([]);

    const initializeDB = async () => {
      try {
        await loadVocabularyFromJSON(`/${level}.json`, level);

        if (!cancelled) {
          setInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize vocabulary database:', error);
      }
    };

    initializeDB();

    return () => {
      cancelled = true;
    };
  }, [level, enabled]);

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

  return { words, setWords, loading, fetchWords, initialized };
};
