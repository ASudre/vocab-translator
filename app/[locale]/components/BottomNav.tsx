'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { SVGProps } from 'react';

/**
 * Outline vs. filled variant of each icon, matched to the tab's active
 * state (the same visual language iOS/Android tab bars use). Kept as plain
 * inline SVG rather than an icon library: three icons don't justify a new
 * dependency, and inlining avoids an extra chunk for the service worker's
 * offline cache to fetch.
 */
function LearnIcon({ active, ...props }: { active: boolean } & SVGProps<SVGSVGElement>) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 4.5c-2.4-1.6-5.4-2.4-8-1.9v14.2c2.6-.5 5.6.3 8 1.9 2.4-1.6 5.4-2.4 8-1.9V2.6c-2.6-.5-5.6.3-8 1.9Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 4.5c-2.4-1.6-5.4-2.4-8-1.9v14.2c2.6-.5 5.6.3 8 1.9 2.4-1.6 5.4-2.4 8-1.9V2.6c-2.6-.5-5.6.3-8 1.9Z" />
      <path d="M12 4.5v14.2" />
    </svg>
  );
}

function ReviseIcon({ active, ...props }: { active: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5" />
      <path d="M20 4v4.5h-4.5" />
      <path d="M20 12a8 8 0 0 1-13.66 5.66L4 15.5" />
      <path d="M4 20v-4.5h4.5" />
    </svg>
  );
}

function ProfileIcon({ active, ...props }: { active: boolean } & SVGProps<SVGSVGElement>) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.25a7.5 7.5 0 0 1 15 0 .75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.25a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

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
    `flex-1 flex flex-col items-center gap-1 py-2 text-xs font-semibold transition-colors ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
    }`;

  const iconWrapperClasses = (active: boolean) =>
    `flex items-center justify-center h-8 w-12 rounded-full transition-colors ${active ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''
    }`;

  return (
    <nav
      className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      aria-label={t('ariaLabel')}
    >
      <div className="container mx-auto max-w-2xl flex">
        <Link href={learnHref} className={tabClasses(isLearnActive)} aria-current={isLearnActive ? 'page' : undefined}>
          <span className={iconWrapperClasses(isLearnActive)}>
            <LearnIcon active={isLearnActive} className="h-5 w-5" aria-hidden="true" />
          </span>
          {t('learn')}
        </Link>
        <Link href={reviseHref} className={tabClasses(isReviseActive)} aria-current={isReviseActive ? 'page' : undefined}>
          <span className={iconWrapperClasses(isReviseActive)}>
            <ReviseIcon active={isReviseActive} className="h-5 w-5" aria-hidden="true" />
          </span>
          {t('revise')}
        </Link>
        <Link href={profileHref} className={tabClasses(isProfileActive)} aria-current={isProfileActive ? 'page' : undefined}>
          <span className={iconWrapperClasses(isProfileActive)}>
            <ProfileIcon active={isProfileActive} className="h-5 w-5" aria-hidden="true" />
          </span>
          {t('profile')}
        </Link>
      </div>
    </nav>
  );
}
