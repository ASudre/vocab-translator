import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { performSync } from '@/lib/syncClient';
import { clearUserProgressAndQueue } from '@/lib/indexedDB';

/** Tracks which account's progress is currently on this device (see identity-transition handling below). */
const LAST_SYNCED_USER_KEY = 'vocabDB_lastSyncedUserId';

/**
 * Drives progress sync while logged in: identity transitions (a different
 * account logging in on this device must not see the previous account's
 * local progress), and flush triggers (login, reconnecting, the tab
 * regaining visibility). `onSynced` lets the caller refresh anything
 * derived from IndexedDB (e.g. mastery stats) once a pull has merged in.
 */
export const useSync = (onSynced?: () => void) => {
  const { ready, user } = useAuth();
  const inFlight = useRef(false);
  const onSyncedRef = useRef(onSynced);
  useEffect(() => {
    onSyncedRef.current = onSynced;
  });

  const triggerSync = useCallback(async () => {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    try {
      await performSync(user.id);
      onSyncedRef.current?.();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      inFlight.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!ready || !user) return;

    const run = async () => {
      const lastSyncedUserId = localStorage.getItem(LAST_SYNCED_USER_KEY);
      if (lastSyncedUserId && lastSyncedUserId !== user.id) {
        await clearUserProgressAndQueue();
      }
      localStorage.setItem(LAST_SYNCED_USER_KEY, user.id);
      await triggerSync();
    };
    run();
    // triggerSync intentionally excluded: it's stable per `user`, which is
    // already a dependency, and including it would re-run this identity
    // check (and its clear-on-switch side effect) on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id]);

  useEffect(() => {
    if (!user) return;

    window.addEventListener('online', triggerSync);
    document.addEventListener('visibilitychange', triggerSync);
    return () => {
      window.removeEventListener('online', triggerSync);
      document.removeEventListener('visibilitychange', triggerSync);
    };
  }, [user, triggerSync]);

  return { triggerSync };
};
