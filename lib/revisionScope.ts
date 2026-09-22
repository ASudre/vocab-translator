export const REVISION_SCOPE_KEY = 'vocabDB_revisionScope';

export type RevisionScope = 'level' | 'all';

const isValidScope = (value: string | null): value is RevisionScope => value === 'level' || value === 'all';

/** Self-heals to 'level' (the more conservative default) for anything unset or unrecognized. */
export const readRevisionScope = (): RevisionScope => {
  const raw = localStorage.getItem(REVISION_SCOPE_KEY);
  return isValidScope(raw) ? raw : 'level';
};

/**
 * Wrapped in try/catch so a full or disabled localStorage (Safari private
 * mode, iOS quota) can't surface as a failed answer.
 */
export const writeRevisionScope = (scope: RevisionScope): void => {
  try {
    localStorage.setItem(REVISION_SCOPE_KEY, scope);
  } catch (error) {
    console.error('Failed to save revision scope:', error);
  }
};
