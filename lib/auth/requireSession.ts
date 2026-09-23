import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, SessionPayload, verifySessionToken } from './session';

/** Reads and verifies the session cookie for the current request. Null if absent/invalid/expired. */
export const getSession = async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
};
