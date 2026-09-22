import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { renderWithIntl } from '../helpers/renderWithIntl';
import { LEARNING_DAILY_GOAL_KEY, REVISION_DAILY_GOAL_KEY } from '@/lib/dailyGoal';

// Revision renders BottomNav, which calls next/navigation's usePathname -
// real only inside the App Router, so it's mocked here the same way as in
// tests/components/BottomNav.test.tsx.
vi.mock('next/navigation', () => ({ usePathname: () => '/fr/revision/' }));

const REQUIRED_MASTERED = 10;

const vocabPayload = {
  version: '1.0.0',
  list: Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    spanish: `es${i + 1}`,
    french: `fr${i + 1}`,
    english: `en${i + 1}`,
    category: 'test',
    class: 'noun',
  })),
};

// Mirrors tests/app/page.test.tsx's freshHome: reset the real-IndexedDB
// dependency graph and the fake backing store before each test, and
// optionally pre-master a number of words directly (bypassing the UI) to
// exercise the revision gate.
const freshRevision = async (masteredCount = REQUIRED_MASTERED) => {
  vi.resetModules();
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    statusText: 'OK',
    json: () => Promise.resolve(vocabPayload),
  }));

  const db = await import('@/lib/indexedDB');
  for (let id = 1; id <= masteredCount; id++) {
    await db.saveUserProgress(id, true);
    await db.saveUserProgress(id, true);
    await db.saveUserProgress(id, true);
  }

  const { default: Revision } = await import('@/app/[locale]/revision/page');
  return Revision;
};

const typeWord = (word: string) => {
  for (const char of word) {
    fireEvent.keyDown(window, { key: char });
  }
};

// See tests/app/page.test.tsx for why this macrotask yield is needed: the
// window keydown listener re-subscribes in a passive effect that can lag one
// tick behind the word becoming visible.
const settle = () => act(async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
});

describe('Revision page (integration)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gates the page when fewer than 10 words are mastered', async () => {
    const Revision = await freshRevision(3);
    renderWithIntl(<Revision />);

    await screen.findByText('Continue à apprendre !');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('unlocks and drills a mastered word once 10 are mastered', async () => {
    const Revision = await freshRevision();
    renderWithIntl(<Revision />);

    await screen.findByRole('textbox');
    // One of the 10 mastered French prompts should be on screen.
    await screen.findByText((text) => /^fr(?:[1-9]|10)$/.test(text));
  });

  it('a wrong answer demotes the word out of mastery, and it reappears in learning', async () => {
    const Revision = await freshRevision();
    renderWithIntl(<Revision />);

    const frenchEl = await screen.findByText((text) => /^fr(?:[1-9]|10)$/.test(text));
    const shownId = Number(frenchEl.textContent!.replace('fr', ''));
    await settle();

    typeWord('zzz');
    fireEvent.keyDown(window, { key: 'Enter' });
    await screen.findByText(/Réessaye/);

    const { getUserProgress, getUnmasteredVocabulary } = await import('@/lib/indexedDB');
    await waitFor(async () => {
      const progress = await getUserProgress(shownId);
      expect(progress?.masteryLevel).toBe(0);
    });

    const unmastered = await getUnmasteredVocabulary('a1', 20);
    expect(unmastered.map(w => w.id)).toContain(shownId);
  });

  it('a correct answer records into the revision daily goal, not the learning one', async () => {
    const Revision = await freshRevision();
    renderWithIntl(<Revision />);

    const frenchEl = await screen.findByText((text) => /^fr(?:[1-9]|10)$/.test(text));
    const shownId = Number(frenchEl.textContent!.replace('fr', ''));
    await settle();

    typeWord(`es${shownId}`);
    fireEvent.keyDown(window, { key: 'Enter' });
    await screen.findByText(/Correct/);

    await waitFor(() => {
      const revisionGoal = JSON.parse(localStorage.getItem(REVISION_DAILY_GOAL_KEY)!);
      expect(revisionGoal.ids).toContain(shownId);
    });

    expect(localStorage.getItem(LEARNING_DAILY_GOAL_KEY)).toBeNull();
  });

  it('a correct revision answer does not move masteredAt, so the learning page\'s "mastered today" count is unaffected', async () => {
    const Revision = await freshRevision();
    renderWithIntl(<Revision />);

    const frenchEl = await screen.findByText((text) => /^fr(?:[1-9]|10)$/.test(text));
    const shownId = Number(frenchEl.textContent!.replace('fr', ''));
    await settle();

    const { getUserProgress } = await import('@/lib/indexedDB');
    const before = await getUserProgress(shownId);

    typeWord(`es${shownId}`);
    fireEvent.keyDown(window, { key: 'Enter' });
    await screen.findByText(/Correct/);

    await waitFor(async () => {
      const after = await getUserProgress(shownId);
      expect(after?.lastPracticed).not.toBe(before?.lastPracticed);
    });

    const after = await getUserProgress(shownId);
    expect(after?.masteredAt).toBe(before?.masteredAt);
  });
});
