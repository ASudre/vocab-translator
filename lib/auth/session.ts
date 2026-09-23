import { jwtVerify, SignJWT } from 'jose';

export const SESSION_COOKIE_NAME = 'palabras_session';
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SessionPayload {
  userId: string;
  email: string;
}

const secretKey = (): Uint8Array => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
};

export const createSessionToken = async (payload: SessionPayload): Promise<string> =>
  new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey());

/** Returns null for a missing, malformed or expired token rather than throwing. */
export const verifySessionToken = async (token: string): Promise<SessionPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
};

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DURATION_SECONDS,
};
