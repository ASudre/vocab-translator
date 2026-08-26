#!/usr/bin/env python3
"""Apply manual corrections/exclusions on top of the DeepL cache and emit final
per-level word+translation lists (still without thematic category, added later)."""
import json
from pathlib import Path

HERE = Path(__file__).parent
OUTPUT_DIR = HERE / "output"
LEVELS = ["a1", "a2", "b1", "b2", "c1"]


def main():
    cache = json.loads((OUTPUT_DIR / "translations.cache.json").read_text())
    corrections = json.loads((OUTPUT_DIR / "manual_corrections.json").read_text())
    exclusions = json.loads((OUTPUT_DIR / "exclusions.json").read_text())

    for word, fix in corrections.items():
        cache[word].update(fix)

    for level in LEVELS:
        candidates = json.loads((OUTPUT_DIR / f"{level}.candidates.json").read_text())
        final = []
        excluded_count = 0
        for c in candidates:
            word = c["spanish"]
            if word in exclusions:
                excluded_count += 1
                continue
            t = cache[word]
            final.append(
                {
                    "spanish": word,
                    "english": t["english"],
                    "french": t["french"],
                    "pos_tag": c["pos_tag"],
                    "level": level,
                }
            )
        out_path = OUTPUT_DIR / f"{level}.final.json"
        out_path.write_text(json.dumps(final, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{level}: {len(final)} words ({excluded_count} excluded) -> {out_path.name}")


if __name__ == "__main__":
    main()
