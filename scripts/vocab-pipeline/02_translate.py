#!/usr/bin/env python3
"""Translate ELELex candidate word lists ES->EN and ES->FR via the DeepL API.

Reads DEEPL_API_KEY from the environment (see .env.local). Caches results per
word pair so reruns are cheap and interruption-safe.
"""
import json
import os
import time
from pathlib import Path

import requests

HERE = Path(__file__).parent
OUTPUT_DIR = HERE / "output"
CACHE_PATH = OUTPUT_DIR / "translations.cache.json"
LEVELS = ["a1", "a2", "b1", "b2", "c1"]
BATCH_SIZE = 50
DEEPL_URL = "https://api-free.deepl.com/v2/translate"


def load_api_key():
    key = os.environ.get("DEEPL_API_KEY")
    if key:
        return key
    env_local = HERE.parent.parent / ".env.local"
    for line in env_local.read_text().splitlines():
        if line.startswith("DEEPL_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("DEEPL_API_KEY not found in environment or .env.local")


def deepl_translate(words, target_lang, api_key, max_retries=6):
    for attempt in range(max_retries):
        resp = requests.post(
            DEEPL_URL,
            headers={"Authorization": f"DeepL-Auth-Key {api_key}"},
            data=[("text", w) for w in words]
            + [("source_lang", "ES"), ("target_lang", target_lang)],
            timeout=30,
        )
        if resp.status_code == 429:
            wait = 2 ** attempt * 2
            print(f"  429 rate limited, backing off {wait}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return [t["text"] for t in resp.json()["translations"]]
    raise RuntimeError("Exceeded retries on DeepL 429 rate limiting")


def main():
    api_key = load_api_key()

    all_words = set()
    for level in LEVELS:
        candidates = json.loads((OUTPUT_DIR / f"{level}.candidates.json").read_text())
        all_words.update(c["spanish"] for c in candidates)
    all_words = sorted(all_words)
    print(f"{len(all_words)} unique words across all levels")

    cache = {}
    if CACHE_PATH.exists():
        cache = json.loads(CACHE_PATH.read_text())

    to_translate = [w for w in all_words if w not in cache]
    print(f"{len(to_translate)} not yet cached")

    total_chars = 0
    for i in range(0, len(to_translate), BATCH_SIZE):
        batch = to_translate[i : i + BATCH_SIZE]
        en = deepl_translate(batch, "EN-US", api_key)
        fr = deepl_translate(batch, "FR", api_key)
        for w, e, f in zip(batch, en, fr):
            cache[w] = {"english": e, "french": f}
            total_chars += len(w)
        CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  translated {i + len(batch)}/{len(to_translate)}")
        time.sleep(2)

    print(f"Done. Cache has {len(cache)} entries at {CACHE_PATH}")


if __name__ == "__main__":
    main()
