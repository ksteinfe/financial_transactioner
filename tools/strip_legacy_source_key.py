#!/usr/bin/env python3
"""Remove legacy `source_key` from corpus year files (not part of the schema).

Usage:
  python tools/strip_legacy_source_key.py
  python tools/strip_legacy_source_key.py <corpus-dir>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from corpus_summary import iter_year_json_files, rebuild_corpus_summary
from utils import load_dotenv, resolve_repo_root, write_json_file

DEFAULT_CORPUS = Path(r"I:\My Drive\Homestead\Finance\Budget and Tracking\Corpus")


def resolve_corpus_dir(argv: list[str]) -> Path:
    if len(argv) > 1:
        return Path(argv[1]).expanduser().resolve()
    env = load_dotenv(resolve_repo_root())
    configured = (env.get('TRANSACTION_CORPUS_DIR') or '').strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return DEFAULT_CORPUS


def main() -> int:
    corpus_dir = resolve_corpus_dir(sys.argv)
    if not corpus_dir.is_dir():
        raise SystemExit(f'Corpus directory not found: {corpus_dir}')

    year_files = iter_year_json_files(corpus_dir)
    if not year_files:
        raise SystemExit(f'No year JSON files found in {corpus_dir}')

    total_removed = 0
    files_changed = 0

    print(f'Corpus: {corpus_dir}')
    for path in year_files:
        with path.open(encoding='utf-8') as handle:
            data = json.load(handle)
        if not isinstance(data, dict) or not isinstance(data.get('transactions'), list):
            print(f'  {path.name}: skipped (unexpected shape)')
            continue

        removed = 0
        for txn in data['transactions']:
            if isinstance(txn, dict) and 'source_key' in txn:
                del txn['source_key']
                removed += 1

        if removed:
            write_json_file(path, data)
            files_changed += 1
            total_removed += removed
            print(f'  {path.name}: removed source_key from {removed} transaction(s)')
        else:
            print(f'  {path.name}: none')

    print()
    print(f'Files changed: {files_changed}')
    print(f'source_key fields removed: {total_removed}')

    if files_changed:
        summary_path = rebuild_corpus_summary(corpus_dir)
        print(f'Rebuilt corpus-summary.json -> {summary_path}')
    else:
        print('No corpus writes; summary unchanged.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
