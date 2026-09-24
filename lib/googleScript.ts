// Google Identity Services (https://accounts.google.com/gsi/client) exposes
// two independent namespaces once loaded: `accounts.id` for sign-in (an ID
// token, identity only - see lib/googleAuth.ts) and `accounts.oauth2` for
// requesting a scoped access token against a Google API (e.g. Drive - see
// lib/googleDrive.ts). Both features share this one script load.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let loaded = false;
const listeners = new Set<() => void>();

export const markGoogleScriptLoaded = (): void => {
  loaded = true;
  listeners.forEach(listener => listener());
};

export const isGoogleScriptLoaded = (): boolean => loaded;

export const subscribeGoogleScript = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

let loadPromise: Promise<void> | null = null;

/**
 * Injects the GSI script on demand instead of on every profile page visit,
 * so a signed-in user (no sign-in button to render) only pulls it over the
 * network the moment they actually use Drive backup/restore - see
 * GoogleSignInButton.tsx and hooks/useGoogleDrive.ts. Idempotent: safe to
 * call from multiple call sites.
 */
export const loadGoogleScript = (): Promise<void> => {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      markGoogleScriptLoaded();
      resolve();
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Google script'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
};
