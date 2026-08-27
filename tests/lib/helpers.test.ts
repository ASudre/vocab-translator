import { describe, it, expect } from 'vitest';
import { checkAnswerCorrectness } from '@/lib/helpers';

describe('checkAnswerCorrectness', () => {
  it('accepts an exact match', () => {
    expect(checkAnswerCorrectness('hola', 'hola')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(checkAnswerCorrectness('HOLA', 'hola')).toBe(true);
  });

  it('trims surrounding whitespace on the user answer', () => {
    expect(checkAnswerCorrectness('  hola  ', 'hola')).toBe(true);
  });

  it('rejects an incorrect answer', () => {
    expect(checkAnswerCorrectness('adios', 'hola')).toBe(false);
  });

  it('accepts any of a comma-separated list of accepted answers', () => {
    expect(checkAnswerCorrectness('zumo', 'jugo, zumo')).toBe(true);
    expect(checkAnswerCorrectness('jugo', 'jugo, zumo')).toBe(true);
  });

  it('relies on accepted answers being joined with a literal ", " (comma-space)', () => {
    // No space after the comma means the split never occurs, so the whole
    // string is compared as one answer. Documents that this is a positional
    // convention, not a real parse.
    expect(checkAnswerCorrectness('zumo', 'jugo,zumo')).toBe(false);
    // Extra internal whitespace survives the split, then gets trimmed away
    // when each candidate is normalized.
    expect(checkAnswerCorrectness('zumo', 'jugo,  zumo')).toBe(true);
  });

  it('does not strip accents (documents current, non-accent-insensitive behaviour)', () => {
    expect(checkAnswerCorrectness('como estas', '¿Cómo estás?')).toBe(false);
    expect(checkAnswerCorrectness('anos', 'años')).toBe(false);
  });

  it('treats two empty strings as a match (documents current behaviour)', () => {
    expect(checkAnswerCorrectness('', '')).toBe(true);
  });

  it('rejects a whitespace-only answer against a real word', () => {
    expect(checkAnswerCorrectness('   ', 'hola')).toBe(false);
  });
});
