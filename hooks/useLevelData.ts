import { useEffect, useState } from 'react';
import { loadVocabularyFromJSON } from '@/lib/indexedDB';
import { CEFRLevel } from '@/lib/levels';

/**
 * Ensures every given level's vocabulary JSON is loaded into IndexedDB,
 * loading them one at a time (concurrent writes to the shared vocabulary
 * store is exactly what corrupts it - see loadVocabularyFromJSON), and
 * reports once all of them are ready.
 *
 * `enabled` gates loading until the caller has settled on the real levels to
 * load (e.g. after restoring a persisted level/scope from localStorage) -
 * starting early on a default value can race a subsequent switch.
 */
export const useLevelData = (levels: CEFRLevel[], enabled: boolean = true): { ready: boolean } => {
  const [ready, setReady] = useState(false);
  // Stable primitive key for the effect dependency: an array literal from
  // the caller would otherwise be a new reference every render.
  const levelsKey = levels.join(',');

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setReady(false);

    const load = async () => {
      try {
        for (const level of levels) {
          if (cancelled) return;
          await loadVocabularyFromJSON(`/${level}.json`, level);
        }
        if (!cancelled) {
          setReady(true);
        }
      } catch (error) {
        console.error('Failed to initialize vocabulary database:', error);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelsKey, enabled]);

  return { ready };
};
