# Vocabulary enrichment pipeline (A1–C1)

Builds CEFR-graded Spanish vocabulary lists from a real, sourced dataset instead of
LLM-generated word lists, per the project owner's requirement.

## Source

[ELELex](https://cental.uclouvain.be/cefrlex/elelex/) (CEFRLex project, CENTAL/UCLouvain) —
14,290 Spanish lexical entries with per-CEFR-level frequency, derived from real graded
textbook/reader corpora. License: **CC BY-NC-SA 4.0** (attribution required, non-commercial,
share-alike). No C2 tier (CEFRLex doesn't cover C2 for any language — corpora are scarce),
and no English/French translations — those are added in a later stage.

Raw file: `data/ELELex.tsv` (downloaded from
`https://cental.uclouvain.be/cefrlex/static/resources/es/ELELex.tsv`).

## Step 1 — level assignment (`01_build_levels.py`)

ELELex gives each (word, POS) pair a frequency *at every level*, not one label. We derive a
single "introduction level" per word: the **lowest level at which the word appears in at
least N distinct course-book documents** (`nb_doc@<level>`), which approximates "the level at
which a learner would plausibly first meet this word" better than picking the level of peak
frequency (which can misplace common basic words that happen to recur a lot in a higher-level
corpus).

- Threshold N=3 for A1/A2/B1 (ample data, keeps noise out).
- Threshold N=2 for B2/C1 only, where ELELex's corpus is thinner — documented here rather than
  silently applied, since it's the one subjective knob in an otherwise mechanical pipeline.
- Restricted to content-word POS tags (nouns, verbs, adjectives, adverbs, interjections);
  function words (articles, pronouns, conjunctions, prepositions) are excluded — they're
  already covered by the existing hand-authored `public/a1.json`.
- Multi-word entries (ELELex collocations like `a_la_moda`) are excluded from this pass.
- When a word has multiple POS entries, the one with the highest total corpus frequency wins.

Output: `output/<level>.candidates.json` — word, POS tag, level, frequency (no translation or
category yet).

## Step 2 — translation (not yet run)

Pending a DeepL API key. Plan: DeepL for the bulk ES→EN / ES→FR pass, cross-checked against
Wiktionary's structured extract (kaikki.org) for words with existing entries, to flag likely
single-sense MT errors (e.g. "banco" = bank/bench) for manual review.

## Step 3 — thematic categories (not yet run)

ELELex has no thematic grouping (only POS). Categories analogous to `a1.json`'s `"Saludos"`
etc. are hand-assigned per word as a judgment pass, not sourced from the dataset.
