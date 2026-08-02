#!/usr/bin/env python3
"""Rebuild corpus-summary.json from the current yearly corpus files.

Usage:
  python tools/rebuild_corpus_summary.py
  python tools/rebuild_corpus_summary.py --corpus-dir "I:/path/to/Corpus"

Reads TRANSACTION_CORPUS_DIR from the repo-root .env when --corpus-dir is omitted.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from corpus_summary import CORPUS_SUMMARY_FILENAME, rebuild_corpus_summary
from utils import load_dotenv, resolve_repo_root


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Rebuild corpus-summary.json from all YYYY.json files in the corpus.'
    )
    parser.add_argument(
        '--corpus-dir',
        type=Path,
        default=None,
        help='Corpus root directory (defaults to TRANSACTION_CORPUS_DIR from .env)',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.corpus_dir is not None:
        corpus_dir = args.corpus_dir.expanduser().resolve()
    else:
        env = load_dotenv(resolve_repo_root())
        configured = (env.get('TRANSACTION_CORPUS_DIR') or '').strip()
        if not configured:
            raise SystemExit(
                'TRANSACTION_CORPUS_DIR must be set in .env, or pass --corpus-dir'
            )
        corpus_dir = Path(configured).expanduser().resolve()

    if not corpus_dir.is_dir():
        raise SystemExit(f'Corpus directory not found: {corpus_dir}')

    path = rebuild_corpus_summary(corpus_dir)
    print(f'Rebuilt {CORPUS_SUMMARY_FILENAME}')
    print(f'  path: {path}')


if __name__ == '__main__':
    main()
