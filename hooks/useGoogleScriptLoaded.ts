import { useSyncExternalStore } from 'react';
import { isGoogleScriptLoaded, subscribeGoogleScript } from '@/lib/googleScript';

const getServerSnapshot = () => false;

/** Whether https://accounts.google.com/gsi/client has finished loading - see lib/googleScript.ts. */
export const useGoogleScriptLoaded = (): boolean =>
  useSyncExternalStore(subscribeGoogleScript, isGoogleScriptLoaded, getServerSnapshot);
