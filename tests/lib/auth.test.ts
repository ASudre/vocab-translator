// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword, isPasswordStrongEnough, verifyPassword } from '@/lib/auth/password';
import { createSessionToken, verifySessionToken } from '@/lib/auth/session';

describe('lib/auth/password', () => {
  describe('isPasswordStrongEnough', () => {
    it('rejects passwords shorter than the minimum length', () => {
      expect(isPasswordStrongEnough('short')).toBe(false);
    });

    it('accepts passwords at or above the minimum length', () => {
      expect(isPasswordStrongEnough('longenough')).toBe(true);
    });
  });

  describe('hashPassword / verifyPassword', () => {
    it('round-trips a correct password', async () => {
      const hash = await hashPassword('correct horse battery staple');
      expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    });

    it('rejects an incorrect password', async () => {
      const hash = await hashPassword('correct horse battery staple');
      expect(await verifyPassword('wrong password', hash)).toBe(false);
    });

    it('never stores the password in plaintext', async () => {
      const password = 'correct horse battery staple';
      const hash = await hashPassword(password);
      expect(hash).not.toContain(password);
    });
  });
});

describe('lib/auth/session', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = 'test-only-secret-does-not-need-to-be-real';
  });

  it('round-trips a valid session token', async () => {
    const token = await createSessionToken({ userId: 'user-1', email: 'test@example.com' });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ userId: 'user-1', email: 'test@example.com' });
  });

  it('rejects a malformed token', async () => {
    expect(await verifySessionToken('not-a-real-token')).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken({ userId: 'user-1', email: 'test@example.com' });

    const originalSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = 'a-different-secret-entirely';
    const payload = await verifySessionToken(token);
    process.env.AUTH_SECRET = originalSecret;

    expect(payload).toBeNull();
  });
});
