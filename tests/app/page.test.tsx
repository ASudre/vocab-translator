import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
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

// page.tsx re-attaches its window keydown listener in a useEffect keyed on
// currentWord, and that passive effect runs asynchronously after the DOM
// commit that makes the word's text visible (React 18 flushes passive
// effects in a separate task from painting). findByText resolves as soon as
// the text is on screen, which can be a tick before that listener has
// re-subscribed with the up-to-date currentWord closure — normally an
// imperceptible gap, but wide enough to occasionally drop the very next
// keystrokes under the CPU contention of a fully parallel test run. Yielding
// one macrotask (inside act(), so React's effect flush is included) closes
// that window before any test starts driving the keyboard.
const settle = () => act(async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
});

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
    await settle();

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
    await settle();
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
    await settle();

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
    await settle();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('hola'));

    const { getUserProgress } = await import('@/lib/indexedDB');
    await waitFor(async () => {
      const progress = await getUserProgress(1);
      expect(progress).toMatchObject({ successCount: 0, failCount: 1, attemptHistory: [false] });
    });
  });
});
