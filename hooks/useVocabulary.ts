import { useState, useEffect, useCallback } from 'react';
import { supabase, VocabularyItem } from '@/lib/supabase';

export interface TranslationResult {
  spanish: string;
  french: string;
  userAnswer?: string;
  isCorrect?: boolean | null;
  showSolution?: boolean;
}

export const useVocabulary = (wordCount: number = 10) => {
  const [words, setWords] = useState<TranslationResult[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWords = useCallback(async () => {
    setLoading(true);
    setWords([]);

    try {
      const { data, error } = await supabase
        .rpc('get_random_vocabulary', { word_count: wordCount });

      if (error) {
        console.error('Error loading vocabulary:', error);
        return;
      }

      const vocabItems: TranslationResult[] = (data as VocabularyItem[]).map(item => ({
        spanish: item.spanish,
        french: item.french,
        userAnswer: '',
        isCorrect: null,
        showSolution: false
      }));
      
      setWords(vocabItems);
    } catch (error) {
      console.error('Error loading vocabulary:', error);
    } finally {
      setLoading(false);
    }
  }, [wordCount]);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  return { words, setWords, loading, fetchWords };
};
