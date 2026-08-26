#!/usr/bin/env python3
"""Cross-check DeepL translations against Wiktionary's crowd-sourced translation
data, to flag likely single-sense MT errors for manual review (e.g. "banco" ->
DeepL might give "bank", missing the "bench" sense a learner could also need).

Wiktionary doesn't grade by CEFR level and can be incomplete, so this is a
disagreement flag, not a replacement for DeepL -- silence (no Wiktionary entry)
is not itself a problem.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
OUTPUT_DIR = HERE / "output"
WIKTIONARY_JSONL = HERE / "data" / "es-extract.jsonl"
LEVELS = ["a1", "a2", "b1", "b2", "c1"]


def load_candidate_words():
    words = set()
    for level in LEVELS:
        candidates = json.loads((OUTPUT_DIR / f"{level}.candidates.json").read_text())
        words.update(c["spanish"] for c in candidates)
    return words


def build_wiktionary_index(target_words):
    index = {}
    with open(WIKTIONARY_JSONL, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("lang_code") != "es":
                continue
            word = entry.get("word")
            if word not in target_words:
                continue
            bucket = index.setdefault(word, {"english": set(), "french": set()})
            for t in entry.get("translations", []):
                lang = t.get("lang_code")
                w = t.get("word")
                if not w:
                    continue
                if lang == "en":
                    bucket["english"].add(w.lower())
                elif lang == "fr":
                    bucket["french"].add(w.lower())
    return {w: {"english": sorted(v["english"]), "french": sorted(v["french"])} for w, v in index.items()}


def main():
    target_words = load_candidate_words()
    print(f"{len(target_words)} candidate words to cross-check")

    index_path = OUTPUT_DIR / "wiktionary_index.json"
    if index_path.exists():
        print("Reusing cached wiktionary_index.json")
        wiktionary_index = json.loads(index_path.read_text())
    else:
        print("Scanning Wiktionary extract (this streams ~1.2GB, a few minutes)...")
        wiktionary_index = build_wiktionary_index(target_words)
        index_path.write_text(json.dumps(wiktionary_index, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wiktionary has entries for {len(wiktionary_index)}/{len(target_words)} candidate words")

    deepl_cache = json.loads((OUTPUT_DIR / "translations.cache.json").read_text())

    flags = []
    checked = 0
    for word, wik in wiktionary_index.items():
        deepl = deepl_cache.get(word)
        if not deepl:
            continue
        checked += 1
        issues = {}
        deepl_en = deepl["english"].lower().strip()
        deepl_fr = deepl["french"].lower().strip()
        if wik["english"] and not any(deepl_en == w or deepl_en in w or w in deepl_en for w in wik["english"]):
            issues["english"] = {"deepl": deepl["english"], "wiktionary_options": wik["english"]}
        if wik["french"] and not any(deepl_fr == w or deepl_fr in w or w in deepl_fr for w in wik["french"]):
            issues["french"] = {"deepl": deepl["french"], "wiktionary_options": wik["french"]}
        if issues:
            flags.append({"spanish": word, **issues})

    flags_path = OUTPUT_DIR / "crosscheck_flags.json"
    flags_path.write_text(json.dumps(flags, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Checked {checked} words with both DeepL + Wiktionary data")
    print(f"{len(flags)} flagged for manual review -> {flags_path}")


if __name__ == "__main__":
    main()
