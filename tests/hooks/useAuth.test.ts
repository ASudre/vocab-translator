import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// useAuth caches session state at module scope, exactly like useDailyGoal /
// useCombo (see tests/hooks/useDailyGoal.test.ts). Re-import it fresh per
// test so one test's login state can't leak into the next.
const freshUseAuth = async () => {
  vi.resetModules();
  const mod = await import('@/hooks/useAuth');
  return mod;
};

const jsonResponse = (body: unknown, ok = true) => Promise.resolve({
  ok,
  json: () => Promise.resolve(body),
});

describe('useAuth', () => {
  let useAuth: Awaited<ReturnType<typeof freshUseAuth>>['useAuth'];

  beforeEach(async () => {
    ({ useAuth } = await freshUseAuth());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts unready, then bootstraps to loggedOut when /api/auth/me has no user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(jsonResponse({ user: null })));

    const { result } = renderHook(() => useAuth());
    expect(result.current.ready).toBe(false);
    expect(result.current.user).toBeNull();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.user).toBeNull();
  });

  it('bootstraps to loggedIn when /api/auth/me returns a user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(jsonResponse({ user: { id: '1', email: 'a@b.com' } })));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.user).toEqual({ id: '1', email: 'a@b.com' });
  });

  it('login on success updates state to loggedIn and resolves ok:true', async () => {
    const fetchMock = vi.fn()
      .mockReturnValueOnce(jsonResponse({ user: null })) // /api/auth/me bootstrap
      .mockReturnValueOnce(jsonResponse({ user: { id: '1', email: 'a@b.com' } })); // /api/auth/login
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    const loginResult = await result.current.login('a@b.com', 'password123');
    expect(loginResult).toEqual({ ok: true });

    await waitFor(() => expect(result.current.user).toEqual({ id: '1', email: 'a@b.com' }));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/login/', expect.objectContaining({ method: 'POST' }));
  });

  it('login on failure returns the server error and does not change state', async () => {
    const fetchMock = vi.fn()
      .mockReturnValueOnce(jsonResponse({ user: null }))
      .mockReturnValueOnce(jsonResponse({ error: 'Invalid email or password' }, false));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.ready).toBe(true));

    const loginResult = await result.current.login('a@b.com', 'wrong');
    expect(loginResult).toEqual({ ok: false, error: 'Invalid email or password' });
    expect(result.current.user).toBeNull();
  });

  it('logout resets state to loggedOut', async () => {
    const fetchMock = vi.fn()
      .mockReturnValueOnce(jsonResponse({ user: { id: '1', email: 'a@b.com' } })) // bootstrap
      .mockReturnValueOnce(jsonResponse({ ok: true })); // /api/auth/logout
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toEqual({ id: '1', email: 'a@b.com' }));

    await result.current.logout();
    expect(result.current.user).toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/logout/', expect.objectContaining({ method: 'POST' }));
  });
});
