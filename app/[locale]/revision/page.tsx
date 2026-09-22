'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CEFRLevel, TranslationResult, toTranslationResults } from '@/hooks/useVocabularyDB';
import { useLevelData } from '@/hooks/useLevelData';
import { usePracticeSession, WordSource } from '@/hooks/usePracticeSession';
import { useDailyGoal } from '@/hooks/useDailyGoal';
import { useCombo } from '@/hooks/useCombo';
import { getMasteredVocabulary, getMasteredLevels, countMastered } from '@/lib/indexedDB';
import { LEVEL_STORAGE_KEY, isCEFRLevel, readPendingWord } from '@/lib/pendingWord';
import { REVISION_DAILY_GOAL_KEY, REVISION_DAILY_GOAL } from '@/lib/dailyGoal';
import { readRevisionScope, writeRevisionScope, RevisionScope } from '@/lib/revisionScope';
import { PracticeArea } from '../components/PracticeArea';
import { FixedKeyboard } from '../components/FixedKeyboard';
import { RevisionTopBar } from '../components/RevisionTopBar';
import { RevisionGoal } from '../components/RevisionGoal';
import { BottomNav } from '../components/BottomNav';

/** Mastered words required in scope before revision unlocks - below this, a daily count goal isn't meaningfully completable. */
const REQUIRED_MASTERED = 10;

const sessionKeyFor = (scope: RevisionScope, level: CEFRLevel): string =>
  scope === 'all' ? 'revise_all' : `revise_${level}`;

export default function Revision() {
  const [level, setLevel] = useState<CEFRLevel>('a1');
  const [scope, setScope] = useState<RevisionScope>('level');
  const [restored, setRestored] = useState(false);
  const [pendingWord, setPendingWord] = useState<TranslationResult | null>(null);
  const [gateStatus, setGateStatus] = useState<'loading' | 'locked' | 'unlocked'>('loading');
  const [poolCount, setPoolCount] = useState(0);
  const [levelsToLoad, setLevelsToLoad] = useState<CEFRLevel[]>([]);
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
  // and revision scope after mount, before letting anything load. Reading
  // localStorage during SSR would mismatch the prerendered HTML and break
  // hydration (this app is statically exported).
  useEffect(() => {
    const storedLevel = localStorage.getItem(LEVEL_STORAGE_KEY);
    const resolvedLevel = isCEFRLevel(storedLevel) ? storedLevel : 'a1';
    if (isCEFRLevel(storedLevel)) {
      setLevel(storedLevel);
    }

    const resolvedScope = readRevisionScope();
    setScope(resolvedScope);

    setPendingWord(readPendingWord(sessionKeyFor(resolvedScope, resolvedLevel)));
    setRestored(true);
  }, []);

  const handleLevelChange = useCallback((newLevel: CEFRLevel) => {
    setLevel(newLevel);
    localStorage.setItem(LEVEL_STORAGE_KEY, newLevel);
    setPendingWord(readPendingWord(sessionKeyFor(scope, newLevel)));
  }, [scope]);

  const handleScopeChange = useCallback((newScope: RevisionScope) => {
    setScope(newScope);
    writeRevisionScope(newScope);
    setPendingWord(readPendingWord(sessionKeyFor(newScope, level)));
  }, [level]);

  // `null` means "every level the user has ever mastered a word in" - the
  // same convention getMasteredVocabulary/countMastered use.
  const scopeLevels = useMemo(() => (scope === 'all' ? null : [level]), [scope, level]);

  // Re-checked only when the scope/level actually changes, not continuously:
  // a wrong answer demoting a word mid-session can drop the pool below
  // REQUIRED_MASTERED without re-locking an already-unlocked session.
  useEffect(() => {
    if (!restored) return;

    let cancelled = false;
    setGateStatus('loading');

    countMastered(scopeLevels).then(count => {
      if (cancelled) return;
      setPoolCount(count);
      setGateStatus(count >= REQUIRED_MASTERED ? 'unlocked' : 'locked');
    }).catch(error => {
      console.error('Failed to count mastered vocabulary:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [restored, scopeLevels]);

  // Which levels' JSON need to be resident for this scope: just the current
  // level, or - for "all" - every level the user has ever mastered a word
  // in, resolved from progress ids alone (works even before any entries are
  // loaded this session; see getMasteredLevels).
  useEffect(() => {
    if (!restored || gateStatus !== 'unlocked') return;

    if (scope === 'level') {
      setLevelsToLoad([level]);
      return;
    }

    let cancelled = false;
    getMasteredLevels().then(levels => {
      if (!cancelled) setLevelsToLoad(levels);
    }).catch(error => {
      console.error('Failed to resolve mastered levels:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [restored, gateStatus, scope, level]);

  const { ready } = useLevelData(levelsToLoad, restored && gateStatus === 'unlocked' && levelsToLoad.length > 0);

  const refreshPoolCount = useCallback(async () => {
    try {
      setPoolCount(await countMastered(scopeLevels));
    } catch (error) {
      console.error('Failed to count mastered vocabulary:', error);
    }
  }, [scopeLevels]);

  const source: WordSource = useMemo(() => ({
    sessionKey: sessionKeyFor(scope, level),
    ready,
    fetchBatch: async (count, excludeIds) => {
      const entries = await getMasteredVocabulary(scopeLevels, count, excludeIds);
      return toTranslationResults(entries);
    },
  }), [scope, level, ready, scopeLevels]);

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
    onAttemptSaved: refreshPoolCount,
  });

  const sessionComplete = gateStatus === 'unlocked' && ready && fetchedOnce && !loading && words.length === 0;

  return (
    <>
      <RevisionTopBar
        level={level}
        onLevelChange={handleLevelChange}
        scope={scope}
        onScopeChange={handleScopeChange}
        poolCount={poolCount}
      />
      <main className="flex-1 overflow-y-auto container mx-auto px-4 py-4">
        <div className="mb-4">
          <RevisionGoal stats={goalDisplay} />
        </div>

        {gateStatus === 'locked' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 text-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('gateTitle')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('gateBody', { mastered: poolCount, required: REQUIRED_MASTERED })}
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
