'use client';

import { useTranslations } from 'next-intl';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { BottomNav } from '../components/BottomNav';

export default function Profile() {
  const t = useTranslations('Profile');
  const { ready, profile, signOut } = useGoogleAuth();

  return (
    <>
      <div className="w-full border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto">
          <div className="p-4">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('heading')}</h1>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto container mx-auto px-4 py-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 text-center">
          {!ready ? null : profile ? (
            <div className="flex flex-col items-center gap-3">
              {/* Plain <img>, not next/image: a remote Google avatar under a
                  statically exported site would otherwise need the image
                  optimizer, which has no server to run on. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full"
              />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{profile.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 max-w-sm">
                {t('cosmeticNotice')}
              </p>
              <button
                type="button"
                onClick={signOut}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                {t('signOut')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('signedOutBody')}</p>
              <GoogleSignInButton />
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  );
}
