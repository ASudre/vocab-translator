import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../helpers/renderWithIntl';
import { BottomNav } from '@/app/[locale]/components/BottomNav';

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname }));

describe('BottomNav', () => {
  it('renders locale-prefixed hrefs for all three tabs', () => {
    // next/link normalizes away a bare trailing slash when rendered outside
    // the full Next.js router (as in this isolated test); the app's
    // trailingSlash: true config (next.config.ts) applies it back at
    // navigation time in the real build.
    usePathname.mockReturnValue('/fr/');
    renderWithIntl(<BottomNav />);

    expect(screen.getByRole('link', { name: /Apprendre/ })).toHaveAttribute('href', '/fr');
    expect(screen.getByRole('link', { name: /Réviser/ })).toHaveAttribute('href', '/fr/revision');
    expect(screen.getByRole('link', { name: /Profil/ })).toHaveAttribute('href', '/fr/profile');
  });

  it('marks Learn as the current page on the learning route', () => {
    usePathname.mockReturnValue('/fr/');
    renderWithIntl(<BottomNav />);

    expect(screen.getByRole('link', { name: /Apprendre/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Réviser/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /Profil/ })).not.toHaveAttribute('aria-current');
  });

  it('marks Revise as the current page on the revision route', () => {
    usePathname.mockReturnValue('/fr/revision/');
    renderWithIntl(<BottomNav />);

    expect(screen.getByRole('link', { name: /Réviser/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Apprendre/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /Profil/ })).not.toHaveAttribute('aria-current');
  });

  it('marks Profile as the current page on the profile route', () => {
    usePathname.mockReturnValue('/fr/profile/');
    renderWithIntl(<BottomNav />);

    expect(screen.getByRole('link', { name: /Profil/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Apprendre/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /Réviser/ })).not.toHaveAttribute('aria-current');
  });
});
