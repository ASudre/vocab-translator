'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CEFRLevel, TranslationResult, toTranslationResults } from '@/hooks/useVocabularyDB';
import { useLevelData } from '@/hooks/useLevelData';
import { usePracticeSession, WordSource } from '@/hooks/usePracticeSession';
import { useDailyGoal } from '@/hooks/useDailyGoal';
import { useCombo } from '@/hooks/useCombo';
import { getUnmasteredVocabulary, getMasteryStats } from '@/lib/indexedDB';
import { LEVEL_STORAGE_KEY, isCEFRLevel, readPendingWord } from '@/lib/pendingWord';
import { PracticeArea } from './components/PracticeArea';
import { FixedKeyboard } from './components/FixedKeyboard';
import { TopBar } from './components/TopBar';
import { DailyGoal } from './components/DailyGoal';
import { BottomNav } from './components/BottomNav';

export default function Home() {
  const [level, setLevel] = useState<CEFRLevel>('a1');
  const [levelRestored, setLevelRestored] = useState(false);
  const [pendingWord, setPendingWord] = useState<TranslationResult | null>(null);
  const { ready } = useLevelData([level], levelRestored);
  const [masteryStats, setMasteryStats] = useState({ total: 0, mastered: 0, percentage: 0, lifetimeWordsCorrect: 0, masteredToday: 0 });
  const { recordCorrect: recordDailyGoalCorrect, ...dailyGoal } = useDailyGoal();
  const { recordAttempt: recordComboAttempt } = useCombo();
  // useDailyGoal returns a fresh object every render (its recordCorrect
  // callback is stable, but the wrapping object isn't), which would defeat
  // DailyGoal's memo() on every keystroke. Pass down only the
  // display-relevant primitives, memoized on their own values.
  const statsDisplay = useMemo(
    () => ({
      ready: dailyGoal.ready,
      count: dailyGoal.count,
      goal: dailyGoal.goal,
      completed: dailyGoal.completed,
      justCompleted: dailyGoal.justCompleted,
      masteredToday: masteryStats.masteredToday,
    }),
    [
      dailyGoal.ready,
      dailyGoal.count,
      dailyGoal.goal,
      dailyGoal.completed,
      dailyGoal.justCompleted,
      masteryStats.masteredToday,
    ]
  );

  // Restore the previously selected level after mount, before letting
  // useLevelData load anything. This can't be done via a useState lazy
  // initializer because localStorage isn't available during SSR — reading it
  // there would produce a value that mismatches the server-rendered 'a1'
  // default and break hydration. Gating on levelRestored (rather than just
  // setting the level here) avoids a race where the default 'a1' load and a
  // subsequent restored-level load both hit IndexedDB concurrently.
  useEffect(() => {
    const stored = localStorage.getItem(LEVEL_STORAGE_KEY);
    const resolvedLevel = isCEFRLevel(stored) ? stored : 'a1';
    if (isCEFRLevel(stored)) {
      // Syncing from localStorage (unavailable during SSR) on mount, not derived from React state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLevel(stored);
    }
    setPendingWord(readPendingWord(resolvedLevel));
    setLevelRestored(true);
  }, []);

  const handleLevelChange = useCallback((newLevel: CEFRLevel) => {
    setLevel(newLevel);
    localStorage.setItem(LEVEL_STORAGE_KEY, newLevel);
    setPendingWord(readPendingWord(newLevel));
  }, []);

  // Load mastery stats once the current level's data has finished loading into
  // IndexedDB (avoids reading stats mid-reload while switching levels)
  useEffect(() => {
    if (!ready) return;

    const loadStats = async () => {
      try {
        const stats = await getMasteryStats(level);
        setMasteryStats(stats);
      } catch (error) {
        console.error('Failed to load mastery stats:', error);
      }
    };
    loadStats();
  }, [ready, level]);

  const updateMasteryStats = useCallback(async () => {
    try {
      const stats = await getMasteryStats(level);
      setMasteryStats(stats);
    } catch (error) {
      console.error('Failed to update mastery stats:', error);
    }
  }, [level]);

  const source: WordSource = useMemo(() => ({
    sessionKey: level,
    ready,
    fetchBatch: async (count, excludeIds) => {
      const entries = await getUnmasteredVocabulary(level, count);
      const newEntries = excludeIds.length
        ? entries.filter(entry => !excludeIds.includes(entry.id))
        : entries;
      return toTranslationResults(newEntries);
    },
  }), [level, ready]);

  const {
    words,
    currentWord,
    slideDirection,
    shakeAnimation,
    handleKeyPress,
    handleBackspace,
    handleClear,
    handleCheckAnswer,
    handleToggleSolution,
    goToNext,
  } = usePracticeSession({
    source,
    pendingWord,
    recordCombo: recordComboAttempt,
    recordDailyGoal: recordDailyGoalCorrect,
    onAttemptSaved: updateMasteryStats,
  });

  return (
    <>
      <div className="container mx-auto pt-4 px-4 flex flex-col gap-4">
        <TopBar masteryStats={masteryStats} level={level} onLevelChange={handleLevelChange} />
        <DailyGoal stats={statsDisplay} />
      </div>
      <main className="flex-1 overflow-y-auto container mx-auto px-4 pt-4 pb-4">
        <PracticeArea
          words={words}
          currentWord={currentWord}
          slideDirection={slideDirection}
          shakeAnimation={shakeAnimation}
        />
      </main>

      <BottomNav />

      <FixedKeyboard
        hasCurrentWord={!!currentWord}
        showSolution={currentWord?.showSolution || false}
        onKeyPress={handleKeyPress}
        onBackspace={handleBackspace}
        onClear={handleClear}
        onCheckAnswer={handleCheckAnswer}
        onToggleSolution={handleToggleSolution}
        onNext={goToNext}
      />
    </>
  );
}
