import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GOOGLE_PROFILE_STORAGE_KEY } from '@/lib/googleAuth';

const claims = {
  sub: '1234567890',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/pic.jpg',
  exp: 9999999999,
};

const makeIdToken = (payload: Record<string, unknown>): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesignature`;
};

// useGoogleAuth caches state at module scope (required so
// useSyncExternalStore's getSnapshot can return a stable reference across
// calls) - re-import it fresh for every test, mirroring useDailyGoal.test.ts.
const freshUseGoogleAuth = async () => {
  vi.resetModules();
  const mod = await import('@/hooks/useGoogleAuth');
  return mod.useGoogleAuth;
};

describe('useGoogleAuth', () => {
  let useGoogleAuth: Awaited<ReturnType<typeof freshUseGoogleAuth>>;

  beforeEach(async () => {
    localStorage.clear();
    useGoogleAuth = await freshUseGoogleAuth();
  });

  it('is ready immediately with no profile when nothing is stored', () => {
    const { result } = renderHook(() => useGoogleAuth());
    expect(result.current.ready).toBe(true);
    expect(result.current.profile).toBeNull();
  });

  it('restores an existing profile from storage', () => {
    localStorage.setItem(GOOGLE_PROFILE_STORAGE_KEY, JSON.stringify(claims));
    const { result } = renderHook(() => useGoogleAuth());
    expect(result.current.profile).toEqual(claims);
  });

  it('signInWithCredential decodes and persists the profile', () => {
    const { result } = renderHook(() => useGoogleAuth());

    act(() => result.current.signInWithCredential(makeIdToken(claims)));

    expect(result.current.profile).toEqual(claims);
    expect(JSON.parse(localStorage.getItem(GOOGLE_PROFILE_STORAGE_KEY)!)).toEqual(claims);
  });

  it('signInWithCredential ignores an undecodable token, leaving the profile unset', () => {
    const { result } = renderHook(() => useGoogleAuth());

    act(() => result.current.signInWithCredential('not-a-jwt'));

    expect(result.current.profile).toBeNull();
  });

  it('signOut clears the profile and storage', () => {
    const { result } = renderHook(() => useGoogleAuth());
    act(() => result.current.signInWithCredential(makeIdToken(claims)));
    expect(result.current.profile).not.toBeNull();

    act(() => result.current.signOut());

    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem(GOOGLE_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it('shares state across multiple mounted instances', () => {
    const a = renderHook(() => useGoogleAuth());
    const b = renderHook(() => useGoogleAuth());

    act(() => a.result.current.signInWithCredential(makeIdToken(claims)));

    expect(a.result.current.profile).toEqual(claims);
    expect(b.result.current.profile).toEqual(claims);
  });
});
