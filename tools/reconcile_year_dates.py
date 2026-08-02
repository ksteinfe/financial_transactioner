#!/usr/bin/env python3
"""Reconcile a corpus year against ingest JSONL files; backfill `date_original`.

For each transaction in `YYYY.json`, finds the matching ingest row by `key` under
an ingest root (any `*_ingested.jsonl` in that tree). When the corpus `date`
differs from the ingest `date`, sets optional `date_original` to the ingest date
(without overwriting an existing `date_original`). Amount mismatches and missing
source rows are collected and pretty-printed at the end.

Usage:
  python tools/reconcile_year_dates.py --year 2025 --ingest-root "I:/path/to/downloads"
  python tools/reconcile_year_dates.py --year 2025 --ingest-root ./downloads --dry-run
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from corpus_summary import rebuild_corpus_summary
from utils import load_dotenv, normalize_iso_date, resolve_repo_root, write_json_file


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            'Scan a corpus year against *_ingested.jsonl files; '
            'backfill date_original when dates differ.'
        )
    )
    parser.add_argument('--year', required=True, help='Corpus year, e.g. 2025')
    parser.add_argument(
        '--ingest-root',
        required=True,
        type=Path,
        help='Directory whose subfolders contain *_ingested.jsonl files',
    )
    parser.add_argument(
        '--corpus-dir',
        type=Path,
        default=None,
        help='Corpus root (defaults to TRANSACTION_CORPUS_DIR from .env)',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Report and plan changes without writing the year file',
    )
    return parser.parse_args()


def resolve_corpus_dir(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit.expanduser().resolve()
    env = load_dotenv(resolve_repo_root())
    configured = (env.get('TRANSACTION_CORPUS_DIR') or '').strip()
    if not configured:
        raise SystemExit('TRANSACTION_CORPUS_DIR must be set in .env, or pass --corpus-dir')
    return Path(configured).expanduser().resolve()


def find_ingested_jsonl_files(ingest_root: Path) -> list[Path]:
    files = sorted(
        path
        for path in ingest_root.rglob('*')
        if path.is_file() and path.name.endswith('_ingested.jsonl')
    )
    return files


def amounts_equal(a, b) -> bool:
    try:
        return round(float(a), 2) == round(float(b), 2)
    except (TypeError, ValueError):
        return False


def load_ingest_index(files: list[Path]) -> tuple[dict[str, dict], list[str]]:
    """Map transaction key -> {record, source_path}. Collect duplicate-key warnings."""
    index: dict[str, dict] = {}
    warnings: list[str] = []
    for path in files:
        try:
            text = path.read_text(encoding='utf-8')
        except OSError as exc:
            warnings.append(f'Could not read {path}: {exc}')
            continue
        for line_number, line in enumerate(text.splitlines(), start=1):
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                warnings.append(f'Invalid JSON in {path}:{line_number}: {exc}')
                continue
            if not isinstance(record, dict):
                warnings.append(f'Non-object record in {path}:{line_number}')
                continue
            key = record.get('key')
            if not isinstance(key, str) or not key:
                warnings.append(f'Missing key in {path}:{line_number}')
                continue
            if key in index:
                prior = index[key]['source_path']
                warnings.append(
                    f'Duplicate ingest key {key}: keeping {prior}, also seen in {path}'
                )
                continue
            index[key] = {'record': record, 'source_path': str(path)}
    return index, warnings


def pretty_print_errors(errors: list[str]) -> None:
    print()
    print('=' * 80)
    print(f'ERRORS ({len(errors)})')
    print('=' * 80)
    if not errors:
        print('None.')
        return
    for index, message in enumerate(errors, start=1):
        print(f'{index}. {message}')
    print('=' * 80)


def main() -> int:
    args = parse_args()
    year = str(args.year).strip()
    if not year.isdigit() or len(year) != 4:
        raise SystemExit(f'--year must be a 4-digit year string, got: {args.year!r}')

    ingest_root = args.ingest_root.expanduser().resolve()
    if not ingest_root.is_dir():
        raise SystemExit(f'Ingest root not found: {ingest_root}')

    corpus_dir = resolve_corpus_dir(args.corpus_dir)
    year_path = corpus_dir / f'{year}.json'
    if not year_path.is_file():
        raise SystemExit(f'Corpus year file not found: {year_path}')

    ingest_files = find_ingested_jsonl_files(ingest_root)
    print(f'Year:        {year}')
    print(f'Corpus file: {year_path}')
    print(f'Ingest root: {ingest_root}')
    print(f'Ingest files ({len(ingest_files)}):')
    for path in ingest_files:
        try:
            rel = path.relative_to(ingest_root)
        except ValueError:
            rel = path
        print(f'  {rel}')
    if not ingest_files:
        raise SystemExit(f'No *_ingested.jsonl files found under {ingest_root}')

    ingest_index, load_warnings = load_ingest_index(ingest_files)
    print(f'Indexed ingest keys: {len(ingest_index)}')

    with year_path.open(encoding='utf-8') as handle:
        year_data = json.load(handle)
    if not isinstance(year_data, dict) or not isinstance(year_data.get('transactions'), list):
        raise SystemExit(f'Unexpected corpus year shape in {year_path}')

    transactions = year_data['transactions']
    errors: list[str] = list(load_warnings)
    date_original_set = 0
    date_original_preserved = 0
    matched = 0
    unchanged_dates = 0
    changed = False
    now = datetime.now(timezone.utc).isoformat()

    for index, txn in enumerate(transactions):
        if not isinstance(txn, dict):
            errors.append(f'Corpus {year}.json[{index}]: non-object transaction')
            continue
        key = txn.get('key')
        if not isinstance(key, str) or not key:
            errors.append(f'Corpus {year}.json[{index}]: missing key')
            continue

        hit = ingest_index.get(key)
        if hit is None:
            errors.append(
                f'Missing source row for corpus key={key} '
                f'(corpus date={txn.get("date")!r} amount={txn.get("amount")!r} '
                f'desc={txn.get("description")!r})'
            )
            continue

        matched += 1
        source = hit['record']
        source_path = hit['source_path']
        source_date = normalize_iso_date(str(source.get('date') or ''))
        source_amount = source.get('amount')
        corpus_date = str(txn.get('date') or '').strip()
        corpus_amount = txn.get('amount')

        if not amounts_equal(corpus_amount, source_amount):
            errors.append(
                f'Amount mismatch for key={key}: '
                f'corpus={corpus_amount!r} source={source_amount!r} '
                f'(source file={source_path})'
            )

        if not source_date:
            errors.append(
                f'Source row missing/invalid date for key={key} (source file={source_path})'
            )
            continue

        if corpus_date == source_date:
            unchanged_dates += 1
            continue

        existing_original = txn.get('date_original')
        if isinstance(existing_original, str) and existing_original.strip():
            date_original_preserved += 1
            continue

        txn['date_original'] = source_date
        txn['date_updated'] = now
        date_original_set += 1
        changed = True

    print()
    print(f'Corpus transactions:     {len(transactions)}')
    print(f'Matched in ingest:       {matched}')
    print(f'Dates already aligned:   {unchanged_dates}')
    print(f'date_original set:       {date_original_set}')
    print(f'date_original preserved: {date_original_preserved}')
    print(f'Dry run:                 {args.dry_run}')

    if changed and not args.dry_run:
        write_json_file(year_path, year_data)
        print(f'Wrote {year_path}')
        summary_path = rebuild_corpus_summary(corpus_dir)
        print(f'Rebuilt corpus-summary.json -> {summary_path}')
    elif changed and args.dry_run:
        print(f'Dry run: would write {date_original_set} date_original value(s) to {year_path}')
    else:
        print('No corpus writes needed.')

    pretty_print_errors(errors)
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
