'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';

// Mirrors MIN_PASSWORD_LENGTH in lib/auth/password.ts. Duplicated rather than
// imported so this client bundle doesn't pull in bcryptjs (server-only).
const MIN_PASSWORD_LENGTH = 8;

export default function LoginPage() {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const router = useRouter();
  const { ready, user, login, signup } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace(`/${locale}/`);
    }
  }, [ready, user, router, locale]);

  if (!ready || user) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = mode === 'login' ? await login(email, password) : await signup(email, password);

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? t('genericError'));
    }
    // On success, useAuth's state flips to loggedIn and the effect above redirects.
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h1 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {mode === 'login' ? t('login') : t('signup')}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            {t('email')}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            {t('password')}
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>

          {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mode === 'login' ? t('login') : t('signup')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
          }}
          className="mt-4 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {mode === 'login' ? t('switchToSignup') : t('switchToLogin')}
        </button>
      </div>
    </div>
  );
}
