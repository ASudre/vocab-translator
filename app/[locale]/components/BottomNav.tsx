'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Plain next/link with manually locale-prefixed hrefs, not next-intl's
 * createNavigation: with only three routes, no middleware, and
 * trailingSlash: true, that helper would be a second source of routing
 * truth for no gain. Link's automatic prefetch also pulls each route's
 * chunk into the service worker's runtime cache as soon as this nav
 * renders, which is what makes an offline first visit to it work.
 */
export function BottomNav() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('Nav');

  const learnHref = `/${locale}/`;
  const reviseHref = `/${locale}/revision/`;
  const profileHref = `/${locale}/profile/`;
  // usePathname can return null outside a full router context (e.g. during
  // some static-generation edge cases); treat that as "not on this tab"
  // rather than throwing.
  const path = pathname ?? '';
  const isReviseActive = path.startsWith(`/${locale}/revision`);
  const isProfileActive = path.startsWith(`/${locale}/profile`);
  const isLearnActive = !isReviseActive && !isProfileActive;

  const tabClasses = (active: boolean) =>
    `flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
    }`;

  return (
    <nav
      className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      aria-label={t('ariaLabel')}
    >
      <div className="container mx-auto max-w-2xl flex">
        <Link href={learnHref} className={tabClasses(isLearnActive)} aria-current={isLearnActive ? 'page' : undefined}>
          <span aria-hidden="true">📚</span>
          {t('learn')}
        </Link>
        <Link href={reviseHref} className={tabClasses(isReviseActive)} aria-current={isReviseActive ? 'page' : undefined}>
          <span aria-hidden="true">🔁</span>
          {t('revise')}
        </Link>
        <Link href={profileHref} className={tabClasses(isProfileActive)} aria-current={isProfileActive ? 'page' : undefined}>
          <span aria-hidden="true">👤</span>
          {t('profile')}
        </Link>
      </div>
    </nav>
  );
}
