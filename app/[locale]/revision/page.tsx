'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CEFRLevel, TranslationResult, toTranslationResults } from '@/hooks/useVocabularyDB';
import { useLevelData } from '@/hooks/useLevelData';
import { usePracticeSession, WordSource } from '@/hooks/usePracticeSession';
import { useDailyGoal } from '@/hooks/useDailyGoal';
import { useCombo } from '@/hooks/useCombo';
import { getMasteredVocabulary, getMasteryStats, countDemotedToday } from '@/lib/indexedDB';
import { LEVEL_STORAGE_KEY, isCEFRLevel, readPendingWord } from '@/lib/pendingWord';
import { REVISION_DAILY_GOAL_KEY, REVISION_DAILY_GOAL } from '@/lib/dailyGoal';
import { PracticeArea } from '../components/PracticeArea';
import { FixedKeyboard } from '../components/FixedKeyboard';
import { TopBar } from '../components/TopBar';
import { RevisionGoal } from '../components/RevisionGoal';
import { BottomNav } from '../components/BottomNav';

/** Mastered words required in this level before revision unlocks - below this, a daily count goal isn't meaningfully completable. */
const REQUIRED_MASTERED = 10;

const sessionKeyFor = (level: CEFRLevel): string => `revise_${level}`;

export default function Revision() {
  const [level, setLevel] = useState<CEFRLevel>('a1');
  const [restored, setRestored] = useState(false);
  const [pendingWord, setPendingWord] = useState<TranslationResult | null>(null);
  const [gateStatus, setGateStatus] = useState<'loading' | 'locked' | 'unlocked'>('loading');
  const [masteryStats, setMasteryStats] = useState({ total: 0, mastered: 0, percentage: 0 });
  const [demotedTodayCount, setDemotedTodayCount] = useState(0);
  const { recordCorrect: recordRevisionGoalCorrect, ...revisionGoal } = useDailyGoal(REVISION_DAILY_GOAL_KEY, REVISION_DAILY_GOAL);
  const { recordAttempt: recordComboAttempt } = useCombo();
  const t = useTranslations('Revision');

  const goalDisplay = useMemo(
    () => ({
      ready: revisionGoal.ready,
      count: revisionGoal.count,
      goal: revisionGoal.goal,
      completed: revisionGoal.completed,
      justCompleted: revisionGoal.justCompleted,
    }),
    [revisionGoal.ready, revisionGoal.count, revisionGoal.goal, revisionGoal.completed, revisionGoal.justCompleted]
  );

  // Restore the previously selected level (shared with the learning page)
  // after mount, before letting anything load. Reading localStorage during
  // SSR would mismatch the prerendered HTML and break hydration (this app is
  // statically exported).
  useEffect(() => {
    const storedLevel = localStorage.getItem(LEVEL_STORAGE_KEY);
    const resolvedLevel = isCEFRLevel(storedLevel) ? storedLevel : 'a1';
    if (isCEFRLevel(storedLevel)) {
      // Syncing from localStorage (an external system, unavailable during
      // SSR) once on mount - not derived from React state, so this can't be
      // moved to render or replaced by a dependency-driven effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLevel(storedLevel);
    }

    setPendingWord(readPendingWord(sessionKeyFor(resolvedLevel)));
    setRestored(true);
  }, []);

  const handleLevelChange = useCallback((newLevel: CEFRLevel) => {
    setLevel(newLevel);
    localStorage.setItem(LEVEL_STORAGE_KEY, newLevel);
    setPendingWord(readPendingWord(sessionKeyFor(newLevel)));
  }, []);

  // Vocabulary for the current level is loaded unconditionally (not gated on
  // unlock status): the shared TopBar's ProgressBar needs an accurate
  // `total` even while locked, and getMasteryStats below reads mastered
  // counts from this same store.
  const { ready } = useLevelData([level], restored);

  // Only re-checked once vocab for this level is resident (getMasteryStats
  // needs it to scope `total`/`mastered` to this level's ids), and when the
  // level actually changes - not continuously: a wrong answer demoting a
  // word mid-session can drop the pool below REQUIRED_MASTERED without
  // re-locking an already-unlocked session.
  useEffect(() => {
    if (!restored || !ready) return;

    let cancelled = false;
    // Clears stale counts from the previous level immediately, rather than
    // showing outdated gate status while the new query is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGateStatus('loading');

    Promise.all([
      getMasteryStats(level),
      countDemotedToday(level),
    ]).then(([stats, demotedToday]) => {
      if (cancelled) return;
      setMasteryStats(stats);
      setDemotedTodayCount(demotedToday);
      setGateStatus(stats.mastered >= REQUIRED_MASTERED ? 'unlocked' : 'locked');
    }).catch(error => {
      console.error('Failed to load mastery stats:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [restored, ready, level]);

  const refreshCounts = useCallback(async () => {
    try {
      const [stats, demotedToday] = await Promise.all([
        getMasteryStats(level),
        countDemotedToday(level),
      ]);
      setMasteryStats(stats);
      setDemotedTodayCount(demotedToday);
    } catch (error) {
      console.error('Failed to load mastery stats:', error);
    }
  }, [level]);

  // Distinct from `ready` (vocab loaded): words are only fetched once the
  // gate has actually unlocked, so a still-locked session can't populate
  // `currentWord` and make the (always-rendered) keyboard interactive behind
  // the gate card.
  const sessionReady = ready && gateStatus === 'unlocked';

  const source: WordSource = useMemo(() => ({
    sessionKey: sessionKeyFor(level),
    ready: sessionReady,
    fetchBatch: async (count, excludeIds) => {
      const entries = await getMasteredVocabulary(level, count, excludeIds);
      return toTranslationResults(entries);
    },
  }), [level, sessionReady]);

  const {
    words,
    currentWord,
    loading,
    fetchedOnce,
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
    recordDailyGoal: recordRevisionGoalCorrect,
    onAttemptSaved: refreshCounts,
  });

  const sessionComplete = sessionReady && fetchedOnce && !loading && words.length === 0;

  return (
    <>
      <div className="container mx-auto pt-4 px-4 flex flex-col gap-4">
        <TopBar masteryStats={masteryStats} level={level} onLevelChange={handleLevelChange} />
        <RevisionGoal stats={goalDisplay} demotedToday={demotedTodayCount} />
      </div>
      <main className="flex-1 overflow-y-auto container mx-auto px-4 pt-4 pb-4">
        {gateStatus === 'locked' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 text-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('gateTitle')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('gateBody', { mastered: masteryStats.mastered, required: REQUIRED_MASTERED })}
            </p>
          </div>
        )}

        {sessionComplete && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 text-center">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('sessionComplete')}</p>
          </div>
        )}

        {gateStatus === 'unlocked' && (
          <PracticeArea
            words={words}
            currentWord={currentWord}
            slideDirection={slideDirection}
            shakeAnimation={shakeAnimation}
          />
        )}
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
