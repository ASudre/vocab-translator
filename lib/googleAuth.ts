export const GOOGLE_PROFILE_STORAGE_KEY = 'vocabDB_googleProfile';

/**
 * Decoded from a Google ID token's payload - NOT signature-verified. Safe
 * only to display ("signed in as X"); never treat this as proof of identity
 * for anything that matters (e.g. gating a write to a database), since
 * anyone can forge this in their own browser. Real verification requires a
 * server holding Google's public keys - see hooks/useGoogleAuth.ts.
 */
export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string;
  /** Unix seconds; the ID token's own expiry, reused here as this cached profile's. */
  exp: number;
}

const isValidProfile = (value: unknown): value is GoogleProfile => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sub === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.picture === 'string' &&
    typeof candidate.exp === 'number'
  );
};

/**
 * Decodes a Google ID token's payload segment (base64url JSON) without
 * checking its signature. Returns null for anything malformed, or the
 * handful of claims this app displays.
 */
export const decodeGoogleIdToken = (idToken: string): GoogleProfile | null => {
  try {
    const payload = idToken.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    const claims = JSON.parse(json) as Record<string, unknown>;

    const profile = {
      sub: claims.sub,
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
      exp: claims.exp,
    };
    return isValidProfile(profile) ? profile : null;
  } catch {
    return null;
  }
};

export const isProfileExpired = (profile: GoogleProfile, now: Date = new Date()): boolean =>
  profile.exp * 1000 <= now.getTime();

/**
 * Self-heals to null whenever nothing is stored, the stored value is
 * malformed JSON or the wrong shape, or the cached token has expired -
 * mirroring lib/pendingWord.ts's readPendingWord. An expired profile clears
 * its own key so a later read doesn't keep re-discovering it as stale.
 */
export const readGoogleProfile = (now: Date = new Date()): GoogleProfile | null => {
  const raw = localStorage.getItem(GOOGLE_PROFILE_STORAGE_KEY);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    localStorage.removeItem(GOOGLE_PROFILE_STORAGE_KEY);
    return null;
  }

  if (!isValidProfile(parsed)) {
    localStorage.removeItem(GOOGLE_PROFILE_STORAGE_KEY);
    return null;
  }

  if (isProfileExpired(parsed, now)) {
    localStorage.removeItem(GOOGLE_PROFILE_STORAGE_KEY);
    return null;
  }

  return parsed;
};

/** Wrapped in try/catch so a full or disabled localStorage can't surface as a failed sign-in. */
export const writeGoogleProfile = (profile: GoogleProfile): void => {
  try {
    localStorage.setItem(GOOGLE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Failed to save Google profile:', error);
  }
};

export const clearGoogleProfile = (): void => {
  localStorage.removeItem(GOOGLE_PROFILE_STORAGE_KEY);
};
