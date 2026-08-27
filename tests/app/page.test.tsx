import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { renderWithIntl } from '../helpers/renderWithIntl';

const vocabPayload = {
  version: '1.0.0',
  list: [
    { id: 1, spanish: 'hola', french: 'bonjour', english: 'hello', category: 'greeting', class: 'interjection' },
    { id: 2, spanish: 'adios', french: 'au revoir', english: 'goodbye', category: 'greeting', class: 'interjection' },
  ],
};

// Home concentrates real IndexedDB access (via hooks/useVocabularyDB ->
// lib/indexedDB), which memoizes its connection at module scope. Reset the
// whole dependency graph and the fake IDB backing store before each test so
// tests in this file don't see each other's data.
const freshHome = async () => {
  vi.resetModules();
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    statusText: 'OK',
    json: () => Promise.resolve(vocabPayload),
  }));
  // getUnmasteredVocabulary shuffles with real Math.random; pin it so the
  // word order (and therefore which word is "current") is deterministic
  // across these integration tests.
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
  const { default: Home } = await import('@/app/[locale]/page');
  return Home;
};

const typeWord = (word: string) => {
  for (const char of word) {
    fireEvent.keyDown(window, { key: char });
  }
};

describe('Home page (integration)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('typing the correct answer and pressing Enter marks it correct and persists progress on the first attempt only', async () => {
    const Home = await freshHome();
    renderWithIntl(<Home />);

    await screen.findByText('bonjour');

    typeWord('hola');
    fireEvent.keyDown(window, { key: 'Enter' });

    await screen.findByText(/Correct/);
    expect(screen.getByRole('textbox')).toHaveValue('hola');

    const { getUserProgress } = await import('@/lib/indexedDB');
    await waitFor(async () => {
      const progress = await getUserProgress(1);
      expect(progress).toMatchObject({ successCount: 1, failCount: 0, masteryLevel: 1, attemptHistory: [true] });
    });
  });

  it('advances to the next word after answering correctly', async () => {
    const Home = await freshHome();
    renderWithIntl(<Home />);

    await screen.findByText('bonjour');
    typeWord('hola');
    fireEvent.keyDown(window, { key: 'Enter' });
    await screen.findByText(/Correct/);

    // autoAdvance waits 500ms then slides over another 300ms.
    await waitFor(() => expect(screen.getByText('au revoir')).toBeInTheDocument(), { timeout: 2000 });
  });

  it('only records progress on the first attempt for a given word, even after repeated wrong answers', async () => {
    const Home = await freshHome();
    renderWithIntl(<Home />);
    const { getUserProgress } = await import('@/lib/indexedDB');

    await screen.findByText('bonjour');

    typeWord('zzz');
    fireEvent.keyDown(window, { key: 'Enter' });
    await screen.findByText(/Réessaye/);

    // The first attempt's save (and the progressSaved flag it sets) happens
    // asynchronously, after the retry message is already on screen. Wait
    // for it to actually land before firing the second attempt, so this
    // test pins the "only the first attempt is scored" rule rather than the
    // unrelated race of two Enters landing before the first save settles.
    await waitFor(async () => {
      const progress = await getUserProgress(1);
      expect(progress?.failCount).toBe(1);
    });

    typeWord('zzz');
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));

    await waitFor(async () => {
      const progress = await getUserProgress(1);
      expect(progress).toMatchObject({ successCount: 0, failCount: 1, attemptHistory: [false] });
    });

    // Give any stray second-attempt save a moment to (wrongly) land, so a
    // regression of the progressSaved guard would still be caught here.
    await new Promise(resolve => setTimeout(resolve, 50));
    const finalProgress = await getUserProgress(1);
    expect(finalProgress?.failCount).toBe(1);
  });

  it('revealing the solution on an unanswered word records a failure', async () => {
    const Home = await freshHome();
    renderWithIntl(<Home />);

    await screen.findByText('bonjour');

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('hola'));

    const { getUserProgress } = await import('@/lib/indexedDB');
    await waitFor(async () => {
      const progress = await getUserProgress(1);
      expect(progress).toMatchObject({ successCount: 0, failCount: 1, attemptHistory: [false] });
    });
  });
});
