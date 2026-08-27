import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../helpers/renderWithIntl';
import { VocabularyCard } from '@/app/[locale]/components/VocabularyCard';
import { TranslationResult } from '@/hooks/useVocabularyDB';

const baseWord: TranslationResult = {
  vocabularyId: 1,
  spanish: 'hola',
  french: 'bonjour',
  class: 'interjection',
  category: 'greeting',
  userAnswer: '',
  isCorrect: null,
  showSolution: false,
  attemptHistory: [],
  progressSaved: false,
};

describe('VocabularyCard', () => {
  it('renders the French prompt word', () => {
    renderWithIntl(<VocabularyCard word={baseWord} />);
    expect(screen.getByText('bonjour')).toBeInTheDocument();
  });

  it('renders exactly 3 attempt dots regardless of history length', () => {
    const { container } = renderWithIntl(<VocabularyCard word={{ ...baseWord, attemptHistory: [true] }} />);
    const dots = container.querySelectorAll('.w-3.h-3.rounded-full');
    expect(dots).toHaveLength(3);
  });

  it('shows the current userAnswer while unanswered', () => {
    renderWithIntl(<VocabularyCard word={{ ...baseWord, userAnswer: 'ho' }} />);
    expect(screen.getByRole('textbox')).toHaveValue('ho');
  });

  it('reveals the correct answer and clears the user-entered text once correct', () => {
    renderWithIntl(<VocabularyCard word={{ ...baseWord, userAnswer: 'hol', isCorrect: true }} />);
    expect(screen.getByRole('textbox')).toHaveValue('hola');
    expect(screen.getByText(/Correct/)).toBeInTheDocument();
  });

  it('shows the retry message and a first-letter hint when incorrect', () => {
    renderWithIntl(<VocabularyCard word={{ ...baseWord, userAnswer: 'adios', isCorrect: false }} />);
    expect(screen.getByText(/Réessaye/)).toBeInTheDocument();
    expect(screen.getByText('"h"')).toBeInTheDocument();
  });

  it('shows the Spanish answer when the solution is revealed', () => {
    renderWithIntl(<VocabularyCard word={{ ...baseWord, showSolution: true, isCorrect: false }} />);
    expect(screen.getByRole('textbox')).toHaveValue('hola');
  });
});
