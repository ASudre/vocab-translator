import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useVocabularyDB } from '@/hooks/useVocabularyDB';
import * as indexedDB from '@/lib/indexedDB';

vi.mock('@/lib/indexedDB', () => ({
  loadVocabularyFromJSON: vi.fn(),
  getUnmasteredVocabulary: vi.fn(),
  getUserProgress: vi.fn(),
}));

describe('useVocabularyDB', () => {
  beforeEach(() => {
    vi.mocked(indexedDB.loadVocabularyFromJSON).mockReset().mockResolvedValue(undefined);
    vi.mocked(indexedDB.getUnmasteredVocabulary).mockReset().mockResolvedValue([]);
    vi.mocked(indexedDB.getUserProgress).mockReset().mockResolvedValue(null);
  });

  it('does not load anything while disabled (the level-restore race guard)', async () => {
    renderHook(() => useVocabularyDB('a1', 10, false, null));

    // Give any stray microtasks a chance to run.
    await act(async () => {});

    expect(indexedDB.loadVocabularyFromJSON).not.toHaveBeenCalled();
  });

  it('loads the given level once enabled, then becomes initialized', async () => {
    const { result } = renderHook(() => useVocabularyDB('a1', 10, true, null));

    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(indexedDB.loadVocabularyFromJSON).toHaveBeenCalledWith('/a1.json', 'a1');
  });

  it('fetches words automatically once initialized, with no pending word', async () => {
    vi.mocked(indexedDB.getUnmasteredVocabulary).mockResolvedValue([
      { id: 1, English: 'hello', Español: 'hola', Français: 'bonjour', Category: 'greeting', Class: 'interjection' },
    ]);

    const { result } = renderHook(() => useVocabularyDB('a1', 10, true, null));

    await waitFor(() => expect(result.current.words).toHaveLength(1));
    expect(indexedDB.getUnmasteredVocabulary).toHaveBeenCalledWith(10);
    expect(result.current.words[0]).toMatchObject({ vocabularyId: 1, spanish: 'hola', progressSaved: false });
  });

  it('resumes a pending word first, then fetches the rest excluding it', async () => {
    const pendingWord = {
      vocabularyId: 5,
      spanish: 'gato',
      french: 'chat',
      class: 'noun',
      category: 'animal',
    };
    vi.mocked(indexedDB.getUnmasteredVocabulary).mockResolvedValue([
      { id: 5, English: 'cat', Español: 'gato', Français: 'chat', Category: 'animal', Class: 'noun' },
      { id: 6, English: 'dog', Español: 'perro', Français: 'chien', Category: 'animal', Class: 'noun' },
    ]);

    const { result } = renderHook(() => useVocabularyDB('a1', 10, true, pendingWord));

    // The pending word appears immediately, before the async fetch resolves.
    await waitFor(() => expect(result.current.words[0]).toMatchObject({ vocabularyId: 5 }));

    await waitFor(() => expect(result.current.words).toHaveLength(2));
    // Word id 5 (the pending word) was excluded from the fetched batch, so
    // only word 6 should have been appended alongside it.
    expect(result.current.words.map(w => w.vocabularyId)).toEqual([5, 6]);
  });

  it('fetchWords appends to, rather than replaces, the existing word list', async () => {
    vi.mocked(indexedDB.getUnmasteredVocabulary).mockResolvedValueOnce([
      { id: 1, English: 'hello', Español: 'hola', Français: 'bonjour', Category: 'greeting', Class: 'interjection' },
    ]);

    const { result } = renderHook(() => useVocabularyDB('a1', 10, true, null));
    await waitFor(() => expect(result.current.words).toHaveLength(1));

    vi.mocked(indexedDB.getUnmasteredVocabulary).mockResolvedValueOnce([
      { id: 2, English: 'goodbye', Español: 'adios', Français: 'au revoir', Category: 'greeting', Class: 'interjection' },
    ]);

    await act(async () => {
      await result.current.fetchWords();
    });

    expect(result.current.words.map(w => w.vocabularyId)).toEqual([1, 2]);
  });
});
