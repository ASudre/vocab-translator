import { getUserProgress, VocabularyEntry } from '@/lib/indexedDB';
import { CEFR_LEVELS, CEFRLevel } from '@/lib/levels';

export { CEFR_LEVELS, type CEFRLevel };

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

/**
 * Hydrate raw vocabulary entries into the shape a practice session renders,
 * pulling in each word's attempt history so mastery dots resume correctly.
 * Shared by every word source (learning, revision) feeding usePracticeSession.
 */
export const toTranslationResults = async (entries: VocabularyEntry[]): Promise<TranslationResult[]> => {
  return Promise.all(entries.map(async entry => {
    const progress = await getUserProgress(entry.id);

    return {
      vocabularyId: entry.id,
      spanish: entry.Español,
      french: entry.Français,
      class: entry.Class,
      category: entry.Category,
      userAnswer: '',
      isCorrect: null,
      showSolution: false,
      attemptHistory: progress?.attemptHistory || [],
      progressSaved: false,
    };
  }));
};
