import { memo } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';

export const AccountButton = memo(function AccountButton() {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const { ready, user, logout } = useAuth();

  // Fixed-height placeholder while the /api/auth/me bootstrap is in flight,
  // matching the DailyGoal unready-placeholder pattern — avoids a layout
  // shift and a hydration mismatch between server and client render.
  if (!ready) {
    return <div className="h-4 w-16" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <Link
        href={`/${locale}/login/`}
        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        {t('login')}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span className="max-w-[8rem] truncate" title={user.email}>{user.email}</span>
      <button
        type="button"
        onClick={() => logout()}
        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        {t('logout')}
      </button>
    </div>
  );
});
