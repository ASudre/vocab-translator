import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export const runtime = 'nodejs';

// Deliberately generic on every failure path (unknown email vs wrong
// password) so the endpoint can't be used to enumerate registered emails.
const INVALID_CREDENTIALS = { error: 'Invalid email or password' } as const;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, password } = body as { email?: unknown; password?: unknown };

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  const token = await createSessionToken({ userId: user.id, email: user.email });

  const response = NextResponse.json({ user: { id: user.id, email: user.email } });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
  return response;
}
