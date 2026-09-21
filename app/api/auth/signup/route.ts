import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { hashPassword, isPasswordStrongEnough, MIN_PASSWORD_LENGTH } from '@/lib/auth/password';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export const runtime = 'nodejs';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, password } = body as { email?: unknown; password?: unknown };

  if (typeof email !== 'string' || typeof password !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email and password are required' }, { status: 400 });
  }

  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }

  const normalizedEmail = normalizeEmail(email);

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, passwordHash })
    .returning({ id: users.id, email: users.email });

  const token = await createSessionToken({ userId: user.id, email: user.email });

  const response = NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
  return response;
}
