#!/usr/bin/env python3
"""Derive one CEFR level per Spanish word from ELELex's per-level frequency data.

See README.md for the methodology (introduction-threshold leveling) and its rationale.
"""
import csv
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
SOURCE_TSV = HERE / "data" / "ELELex.tsv"
OUTPUT_DIR = HERE / "output"

LEVELS = ["a1", "a2", "b1", "b2", "c1"]
CONTENT_TAGS = {"NCM", "NCF", "NCC", "AQ0", "AQS", "VM", "RG", "I"}

# Minimum number of distinct course-book documents a word must appear in at a
# level to count as "introduced" there. B2/C1 use a lower bar because ELELex's
# underlying corpus has far fewer C1-graded texts than A1/A2/B1 (see README).
DOC_THRESHOLD = {"a1": 3, "a2": 3, "b1": 3, "b2": 2, "c1": 2}


def introduction_level(row):
    for level in LEVELS:
        if float(row[f"nb_doc@{level}"]) >= DOC_THRESHOLD[level]:
            return level
    return None


def main():
    with open(SOURCE_TSV, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t", quotechar='"')
        rows = list(reader)

    candidates = defaultdict(list)  # word -> [(tag, level, total_freq, nb_doc_at_level), ...]
    for row in rows:
        if row["tag"] not in CONTENT_TAGS:
            continue
        if "_" in row["word"] or len(row["word"]) < 2:
            continue
        level = introduction_level(row)
        if level is None:
            continue
        candidates[row["word"]].append(
            (
                row["tag"],
                level,
                float(row["total_freq@total"]),
                float(row[f"nb_doc@{level}"]),
            )
        )

    # A word can qualify via more than one POS tag; keep the highest-frequency one.
    best = {}
    for word, options in candidates.items():
        options.sort(key=lambda o: -o[2])
        best[word] = options[0]

    by_level = defaultdict(list)
    for word, (tag, level, total_freq, nb_doc) in best.items():
        by_level[level].append(
            {
                "spanish": word,
                "pos_tag": tag,
                "level": level,
                "total_freq": total_freq,
                "nb_doc_at_level": nb_doc,
            }
        )

    OUTPUT_DIR.mkdir(exist_ok=True)
    for level in LEVELS:
        items = sorted(by_level[level], key=lambda o: -o["total_freq"])
        out_path = OUTPUT_DIR / f"{level}.candidates.json"
        out_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{level}: {len(items)} candidates -> {out_path.relative_to(HERE.parent.parent)}")


if __name__ == "__main__":
    main()
