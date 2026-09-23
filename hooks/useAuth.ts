import { useCallback, useSyncExternalStore } from 'react';

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthState =
  | { status: 'unready' }
  | { status: 'loggedOut' }
  | { status: 'loggedIn'; user: AuthUser };

/**
 * Sentinel for the pre-hydration/pre-bootstrap snapshot (this app is
 * statically prerendered, and even once mounted, whether a session cookie
 * is valid can only be known after the /api/auth/me round trip resolves).
 * Mirrors the useCombo/useDailyGoal UNREADY_STATE pattern.
 */
const UNREADY_STATE: AuthState = { status: 'unready' };

let cachedState: AuthState = UNREADY_STATE;
let bootstrapped = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

const setState = (next: AuthState): void => {
  cachedState = next;
  notify();
};

const bootstrap = (): void => {
  if (bootstrapped) return;
  bootstrapped = true;

  fetch('/api/auth/me/')
    .then(res => res.json())
    .then((data: { user: AuthUser | null }) => {
      setState(data.user ? { status: 'loggedIn', user: data.user } : { status: 'loggedOut' });
    })
    .catch(() => setState({ status: 'loggedOut' }));
};

const getSnapshot = (): AuthState => cachedState;
const getServerSnapshot = (): AuthState => UNREADY_STATE;

const subscribe = (onStoreChange: () => void): (() => void) => {
  listeners.add(onStoreChange);
  bootstrap();
  return () => listeners.delete(onStoreChange);
};

/** Synchronous read for non-component call sites (e.g. building a SyncContext before saveUserProgress). */
export const getCurrentUser = (): AuthUser | null =>
  cachedState.status === 'loggedIn' ? cachedState.user : null;

interface AuthResult {
  ok: boolean;
  error?: string;
}

const submitCredentials = async (path: string, email: string, password: string): Promise<AuthResult> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();

  if (!response.ok) {
    return { ok: false, error: data.error ?? 'Something went wrong' };
  }

  setState({ status: 'loggedIn', user: data.user });
  return { ok: true };
};

export const useAuth = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback(
    (email: string, password: string) => submitCredentials('/api/auth/login/', email, password),
    []
  );

  const signup = useCallback(
    (email: string, password: string) => submitCredentials('/api/auth/signup/', email, password),
    []
  );

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout/', { method: 'POST' }).catch(() => {});
    setState({ status: 'loggedOut' });
  }, []);

  return {
    ready: state.status !== 'unready',
    user: state.status === 'loggedIn' ? state.user : null,
    login,
    signup,
    logout,
  };
};
