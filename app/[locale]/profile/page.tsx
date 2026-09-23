'use client';

import Script from 'next/script';
import { useTranslations } from 'next-intl';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { markGoogleScriptLoaded } from '@/lib/googleScript';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { BottomNav } from '../components/BottomNav';

export default function Profile() {
  const t = useTranslations('Profile');
  const { ready, profile, signOut } = useGoogleAuth();
  const { status: driveStatus, backup, restore } = useGoogleDrive();

  const handleRestore = () => {
    restore((exportedAt) => window.confirm(t('restoreConfirm', { date: new Date(exportedAt).toLocaleString() })));
  };

  const driveStatusText: Record<string, string> = {
    requestingAccess: t('driveStatusRequestingAccess'),
    uploading: t('driveStatusUploading'),
    downloading: t('driveStatusDownloading'),
    backupSuccess: t('driveStatusBackupSuccess'),
    restoreSuccess: t('driveStatusRestoreSuccess'),
    notFound: t('driveStatusNotFound'),
    invalid: t('driveStatusInvalid'),
    error: t('driveStatusError'),
  };

  return (
    <>
      {/* Shared by GoogleSignInButton (accounts.id) and the Drive backup
          feature (accounts.oauth2) below - loaded once, unconditionally, so
          both are ready regardless of sign-in state. */}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={markGoogleScriptLoaded}
      />

      <div className="w-full border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto">
          <div className="p-2">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('heading')}</h1>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto container mx-auto px-2 py-2 space-y-4">
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
                className="mt-2 px-2 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
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

        {profile && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-2 sm:p-6">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{t('driveHeading')}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('driveBody')}</p>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={backup}
                className="flex-1 px-2 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white"
              >
                {t('backupButton')}
              </button>
              <button
                type="button"
                onClick={handleRestore}
                className="flex-1 px-2 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                {t('restoreButton')}
              </button>
            </div>

            {driveStatusText[driveStatus] && (
              <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">
                {driveStatusText[driveStatus]}
              </p>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
