#!/usr/bin/env python3
"""Compare categories in the corpus against reference/allowed-categories.json."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from corpus_summary import iter_year_json_files

REPO_ROOT = Path(__file__).resolve().parents[1]
ALLOWED_PATH = REPO_ROOT / "reference" / "allowed-categories.json"
DEFAULT_CORPUS = Path(r"I:\My Drive\Homestead\Finance\Budget and Tracking\Corpus")


def load_allowed(path: Path) -> set[str]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise SystemExit(f"Expected a list in {path}")
    return {str(item).strip() for item in data if str(item).strip()}


def collect_corpus_categories(corpus_dir: Path) -> Counter[str]:
    counts: Counter[str] = Counter()
    year_files = iter_year_json_files(corpus_dir)
    if not year_files:
        raise SystemExit(f"No year JSON files found in {corpus_dir}")

    for path in year_files:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
        transactions = data.get("transactions", []) if isinstance(data, dict) else []
        for txn in transactions:
            category = str(txn.get("category") or "").strip()
            if category:
                counts[category] += 1
            else:
                counts["<empty>"] += 1
    return counts


def main() -> int:
    corpus_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CORPUS
    if not corpus_dir.is_dir():
        raise SystemExit(f"Corpus directory not found: {corpus_dir}")
    if not ALLOWED_PATH.is_file():
        raise SystemExit(f"Allowed categories not found: {ALLOWED_PATH}")

    allowed = load_allowed(ALLOWED_PATH)
    corpus_counts = collect_corpus_categories(corpus_dir)
    corpus_cats = set(corpus_counts)

    only_in_corpus = sorted(corpus_cats - allowed)
    only_in_allowed = sorted(allowed - corpus_cats)
    shared = sorted(corpus_cats & allowed)

    print(f"Corpus:   {corpus_dir}")
    print(f"Allowed:  {ALLOWED_PATH}")
    print(f"Corpus categories:  {len(corpus_cats)}")
    print(f"Allowed categories: {len(allowed)}")
    print(f"Shared:             {len(shared)}")
    print()

    print("=" * 60)
    print(f"1) In corpus but NOT in allowed-categories.json ({len(only_in_corpus)})")
    print("=" * 60)
    if only_in_corpus:
        for cat in only_in_corpus:
            print(f"  {cat}  (n={corpus_counts[cat]})")
    else:
        print("  (none)")

    print()
    print("=" * 60)
    print(f"2) In allowed-categories.json but NOT in corpus ({len(only_in_allowed)})")
    print("=" * 60)
    if only_in_allowed:
        for cat in only_in_allowed:
            print(f"  {cat}")
    else:
        print("  (none)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
