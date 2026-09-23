'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useGoogleScriptLoaded } from '@/hooks/useGoogleScriptLoaded';

// Baked in at build time (this app is statically exported - no runtime env).
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Renders Google's own "Sign in with Google" button. The script and the
 * button markup are Google's; this component's only job is wiring the
 * credential callback into useGoogleAuth (decode-only, not verified - see
 * lib/googleAuth.ts). The script itself is loaded once by the page (see
 * profile/page.tsx) so it's shared with the Drive backup feature.
 */
export function GoogleSignInButton() {
  const t = useTranslations('Profile');
  const { signInWithCredential } = useGoogleAuth();
  const scriptLoaded = useGoogleScriptLoaded();
  const buttonRef = useRef<HTMLDivElement>(null);

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

  return <div ref={buttonRef} />;
}
