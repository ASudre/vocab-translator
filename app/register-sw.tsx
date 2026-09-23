'use client';

import { useEffect } from 'react';

export function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Reload exactly once when a new worker takes control, instead of
    // letting it happen silently mid-session.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);

        // A newer version was already installed and waiting from a
        // previous session (e.g. the app was backgrounded during a
        // deploy) — safe to activate it now, at this fresh app start.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  }, []);

  return null;
}
