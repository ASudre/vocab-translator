#!/usr/bin/env python3
"""Merge categories onto translated word lists and write the final public/*.json
files, in the same schema as the existing public/a1.json."""
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
HERE = Path(__file__).parent
OUTPUT_DIR = HERE / "output"
PUBLIC_DIR = ROOT / "public"

LEVELS = ["a1", "a2", "b1", "b2", "c1"]
NUM_CHUNKS = 8

# public/a1.json already has real ids up to ~1737 after merging net-new words.
# a2-c1 get non-overlapping id ranges so IndexedDB (keyed by id) and per-word
# progress tracking never collide across levels, even if a user switches
# levels back and forth.
ID_OFFSET = {"a2": 10_000, "b1": 20_000, "b2": 30_000, "c1": 40_000}

POS_TO_CLASS = {
    "NCM": "noun",
    "NCF": "noun",
    "NCC": "noun",
    "AQ0": "adjective",
    "AQS": "adjective",
    "VM": "verb",
    "RG": "adverb",
    "I": "interjection",
}


def load_category_map():
    cat_map = {}
    for i in range(NUM_CHUNKS):
        chunk = json.loads((OUTPUT_DIR / "chunks" / f"chunk_{i:02d}.categorized.json").read_text())
        for entry in chunk:
            cat_map[entry["spanish"]] = entry["category"]
    return cat_map


def build_entries(level, cat_map):
    words = json.loads((OUTPUT_DIR / f"{level}.final.json").read_text())
    entries = []
    for w in words:
        entries.append(
            {
                "spanish": w["spanish"],
                "english": w["english"],
                "french": w["french"],
                "category": cat_map.get(w["spanish"], ""),
                "class": POS_TO_CLASS[w["pos_tag"]],
            }
        )
    return entries


def write_level_file(level, entries):
    offset = ID_OFFSET[level]
    numbered = []
    for i, e in enumerate(entries, start=1):
        numbered.append({"id": offset + i, **e})
    out_path = PUBLIC_DIR / f"{level}.json"
    out_path.write_text(
        json.dumps({"version": "1.0.0", "list": numbered}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"{level}: wrote {len(numbered)} entries -> {out_path}")


def merge_into_a1(entries):
    a1_path = PUBLIC_DIR / "a1.json"
    a1 = json.loads(a1_path.read_text())
    existing_words = {e["spanish"].lower().strip() for e in a1["list"]}
    max_id = max(e["id"] for e in a1["list"])

    net_new = [e for e in entries if e["spanish"].lower().strip() not in existing_words]

    if not net_new:
        print(f"a1: no net-new entries (of {len(entries)} candidates) — leaving file untouched")
        return

    next_id = max_id + 1
    for e in net_new:
        a1["list"].append({"id": next_id, **e})
        next_id += 1

    # bump patch version, e.g. "1.0.11" -> "1.0.12"
    parts = a1["version"].split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    a1["version"] = ".".join(parts)

    a1_path.write_text(json.dumps(a1, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"a1: appended {len(net_new)} net-new entries (of {len(entries)} candidates), version -> {a1['version']}")


def main():
    cat_map = load_category_map()

    for level in ["a2", "b1", "b2", "c1"]:
        entries = build_entries(level, cat_map)
        write_level_file(level, entries)

    a1_entries = build_entries("a1", cat_map)
    merge_into_a1(a1_entries)


if __name__ == "__main__":
    main()
