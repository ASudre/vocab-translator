import { useCallback, useSyncExternalStore } from 'react';
import {
  GoogleProfile,
  decodeGoogleIdToken,
  readGoogleProfile,
  writeGoogleProfile,
  clearGoogleProfile,
} from '@/lib/googleAuth';

/**
 * Sentinel for the pre-hydration snapshot (this app is statically exported,
 * so localStorage doesn't exist at prerender) - mirrors useCombo/useDailyGoal.
 */
const UNREADY = Symbol('unready');

let cachedState: GoogleProfile | null | typeof UNREADY = UNREADY;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

const getSnapshot = (): GoogleProfile | null | typeof UNREADY => {
  if (cachedState !== UNREADY) return cachedState;
  cachedState = readGoogleProfile();
  return cachedState;
};

const getServerSnapshot = (): GoogleProfile | null | typeof UNREADY => UNREADY;

const subscribe = (onStoreChange: () => void): (() => void) => {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
};

/**
 * Client-only, cosmetic sign-in: decodes (does not verify) a Google ID
 * token to show "signed in as X". Not a real session - see lib/googleAuth.ts.
 * Real verification and any server-backed session land later, behind
 * whatever backend ends up owning the Postgres side.
 */
export const useGoogleAuth = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = state !== UNREADY;
  const profile = ready ? (state as GoogleProfile | null) : null;

  const signInWithCredential = useCallback((idToken: string) => {
    const decoded = decodeGoogleIdToken(idToken);
    if (!decoded) {
      console.error('Failed to decode Google ID token');
      return;
    }
    cachedState = decoded;
    writeGoogleProfile(decoded);
    notify();
  }, []);

  const signOut = useCallback(() => {
    cachedState = null;
    clearGoogleProfile();
    notify();
  }, []);

  return { ready, profile, signInWithCredential, signOut };
};
