// @vitest-environment node
import { describe, it, expect } from 'vitest';
import a1 from '@/public/a1.json';
import a2 from '@/public/a2.json';
import b1 from '@/public/b1.json';
import b2 from '@/public/b2.json';
import c1 from '@/public/c1.json';
import fr from '@/messages/fr.json';
import en from '@/messages/en.json';

interface RawEntry {
  id: number;
  spanish: string;
  english: string;
  french: string;
  category: string;
  class: string;
}

const levels: { name: string; list: RawEntry[] }[] = [
  { name: 'a1', list: a1.list as RawEntry[] },
  { name: 'a2', list: a2.list as RawEntry[] },
  { name: 'b1', list: b1.list as RawEntry[] },
  { name: 'b2', list: b2.list as RawEntry[] },
  { name: 'c1', list: c1.list as RawEntry[] },
];

const allEntries = levels.flatMap(l => l.list.map(entry => ({ ...entry, level: l.name })));

describe('vocabulary data contract (public/*.json)', () => {
  it('has a globally unique id across every level', () => {
    const seen = new Map<number, string>();
    const duplicates: string[] = [];

    for (const entry of allEntries) {
      const existingLevel = seen.get(entry.id);
      if (existingLevel) {
        duplicates.push(`id ${entry.id} appears in both ${existingLevel} and ${entry.level}`);
      } else {
        seen.set(entry.id, entry.level);
      }
    }

    // Progress is keyed by vocabularyId alone (lib/indexedDB.ts), so a
    // colliding id across levels would corrupt another level's progress.
    expect(duplicates).toEqual([]);
  });

  it('has a non-empty spanish and french field for every entry', () => {
    const missing = allEntries.filter(e => !e.spanish || !e.french);
    expect(missing.map(e => `${e.level}#${e.id}`)).toEqual([]);
  });

  it('never uses a comma without a following space in `spanish` (the parsing convention checkAnswerCorrectness relies on)', () => {
    const offenders = allEntries.filter(e => /,(?!\s)/.test(e.spanish));
    expect(offenders.map(e => `${e.level}#${e.id}: ${e.spanish}`)).toEqual([]);
  });

  it('has a translation for every word class used in the data, in both locales', () => {
    const classesUsed = new Set(allEntries.map(e => e.class));
    const frKeys = new Set(Object.keys(fr.WordClass));
    const enKeys = new Set(Object.keys(en.WordClass));

    const missingInFr = [...classesUsed].filter(c => !frKeys.has(c));
    const missingInEn = [...classesUsed].filter(c => !enKeys.has(c));

    // Real bug this test is meant to catch: data uses class "ordinal", but
    // messages/{fr,en}.json define "numeral" (mapped to the word "ordinal")
    // instead of an "ordinal" key. Word id 1023 ("tercero") hits this and
    // throws a next-intl missing-message error in production. This
    // assertion is intentionally the correct invariant (not the current
    // broken state), so it stays red until the key is added or the data
    // is renamed to "numeral".
    expect(missingInFr).toEqual([]);
    expect(missingInEn).toEqual([]);
  });
});
