'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';

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
      };
    };
  }
}

// Baked in at build time (this app is statically exported - no runtime env).
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Renders Google's own "Sign in with Google" button. The script and the
 * button markup are Google's; this component's only job is wiring the
 * credential callback into useGoogleAuth (decode-only, not verified - see
 * lib/googleAuth.ts).
 */
export function GoogleSignInButton() {
  const t = useTranslations('Profile');
  const { signInWithCredential } = useGoogleAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !GOOGLE_CLIENT_ID || !buttonRef.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => signInWithCredential(response.credential),
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
    });
  }, [scriptLoaded, signInWithCredential]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('notConfigured')}
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={buttonRef} />
    </>
  );
}
