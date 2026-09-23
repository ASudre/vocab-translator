import { describe, it, expect, beforeEach } from 'vitest';
import {
  GOOGLE_PROFILE_STORAGE_KEY,
  GoogleProfile,
  decodeGoogleIdToken,
  isProfileExpired,
  readGoogleProfile,
  writeGoogleProfile,
  clearGoogleProfile,
} from '@/lib/googleAuth';

const claims = {
  sub: '1234567890',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/pic.jpg',
  exp: 9999999999,
};

/** Builds a JWT-shaped (but unsigned) string: real Google tokens are signed, but decodeGoogleIdToken never checks that - it only reads the payload segment. */
const makeIdToken = (payload: Record<string, unknown>): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesignature`;
};

describe('decodeGoogleIdToken', () => {
  it('decodes the claims this app displays', () => {
    expect(decodeGoogleIdToken(makeIdToken(claims))).toEqual(claims);
  });

  it('returns null for a token missing a required claim', () => {
    const withoutEmail: Record<string, unknown> = { ...claims };
    delete withoutEmail.email;
    expect(decodeGoogleIdToken(makeIdToken(withoutEmail))).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(decodeGoogleIdToken('not-a-jwt')).toBeNull();
    expect(decodeGoogleIdToken('')).toBeNull();
  });

  it('returns null when the payload segment is not valid JSON', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
    const body = Buffer.from('{not valid json').toString('base64url');
    expect(decodeGoogleIdToken(`${header}.${body}.sig`)).toBeNull();
  });
});

describe('isProfileExpired', () => {
  const profile: GoogleProfile = { ...claims, exp: 1_700_000_000 };

  it('is false before the expiry moment', () => {
    expect(isProfileExpired(profile, new Date(1_699_999_999_000))).toBe(false);
  });

  it('is true at and after the expiry moment', () => {
    expect(isProfileExpired(profile, new Date(1_700_000_000_000))).toBe(true);
    expect(isProfileExpired(profile, new Date(1_700_000_001_000))).toBe(true);
  });
});

describe('readGoogleProfile / writeGoogleProfile / clearGoogleProfile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(readGoogleProfile()).toBeNull();
  });

  it('round-trips a written profile', () => {
    const profile: GoogleProfile = { ...claims, exp: 9999999999 };
    writeGoogleProfile(profile);
    expect(readGoogleProfile()).toEqual(profile);
  });

  it('self-heals and clears the key on malformed JSON', () => {
    localStorage.setItem(GOOGLE_PROFILE_STORAGE_KEY, '{not valid json');
    expect(readGoogleProfile()).toBeNull();
    expect(localStorage.getItem(GOOGLE_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it('self-heals and clears the key for well-formed JSON with the wrong shape', () => {
    localStorage.setItem(GOOGLE_PROFILE_STORAGE_KEY, JSON.stringify({ unrelated: true }));
    expect(readGoogleProfile()).toBeNull();
    expect(localStorage.getItem(GOOGLE_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it('treats an expired cached profile as signed out and clears it', () => {
    const expired: GoogleProfile = { ...claims, exp: 1_700_000_000 };
    writeGoogleProfile(expired);
    expect(readGoogleProfile(new Date(1_700_000_001_000))).toBeNull();
    expect(localStorage.getItem(GOOGLE_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it('clearGoogleProfile removes a stored profile', () => {
    writeGoogleProfile({ ...claims, exp: 9999999999 });
    clearGoogleProfile();
    expect(readGoogleProfile()).toBeNull();
  });

  it('does not throw when localStorage.setItem throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => writeGoogleProfile({ ...claims, exp: 9999999999 })).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
