import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { CEFRLevel } from '@/hooks/useVocabularyDB';
import { RevisionScope } from '@/lib/revisionScope';
import { LevelSelector } from './LevelSelector';
import { MasteryDots } from './MasteryDots';

interface RevisionTopBarProps {
  level: CEFRLevel;
  onLevelChange: (level: CEFRLevel) => void;
  scope: RevisionScope;
  onScopeChange: (scope: RevisionScope) => void;
  poolCount: number;
}

export const RevisionTopBar = memo(function RevisionTopBar({
  level,
  onLevelChange,
  scope,
  onScopeChange,
  poolCount,
}: RevisionTopBarProps) {
  const t = useTranslations('Revision');

  const scopeButtonClasses = (active: boolean) =>
    `px-2 py-1 rounded-md ${active
      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
      : 'text-gray-500 dark:text-gray-400'
    }`;

  return (
    <div className="w-full border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
          <div className="flex items-center gap-3">
            {scope === 'level' && <LevelSelector level={level} onChange={onLevelChange} />}
            <div
              role="group"
              aria-label={t('scopeToggleLabel')}
              className="flex items-center bg-white dark:bg-gray-800 rounded-lg p-1 text-xs font-medium"
            >
              <button
                type="button"
                onClick={() => onScopeChange('level')}
                aria-pressed={scope === 'level'}
                className={scopeButtonClasses(scope === 'level')}
              >
                {t('scopeLevel')}
              </button>
              <button
                type="button"
                onClick={() => onScopeChange('all')}
                aria-pressed={scope === 'all'}
                className={scopeButtonClasses(scope === 'all')}
              >
                {t('scopeAll')}
              </button>
            </div>
          </div>
          <div
            className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400"
            title={t('poolCount', { count: poolCount })}
            aria-label={t('poolCount', { count: poolCount })}
          >
            {poolCount}
            <MasteryDots />
          </div>
        </div>
      </div>
    </div>
  );
});
