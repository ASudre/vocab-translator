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
