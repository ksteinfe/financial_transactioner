#!/usr/bin/env python3
"""Translate a legacy pre-categorized CSV into current ingest JSONL.

Legacy columns (header required):

  date,amount,account,description,category,bank_category,rule_used,notes,transaction_key

Output matches `tools/ingest.py` JSONL records, preserving `transaction_key` as
`key`. Does not write a progress file — these rows are expected to already exist
in the corpus with category/notes metadata.

Usage:
  python tools/translate_legacy_csv.py --input path/to/file.csv
  python tools/translate_legacy_csv.py --input path/to/file.csv --output path/to/out.jsonl
  python tools/translate_legacy_csv.py --input path/to/file.csv --force
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from utils import is_nan, normalize_iso_date, parse_csv_rows, parse_number, uuidv4

REQUIRED_COLUMNS = (
    'date',
    'amount',
    'account',
    'description',
    'category',
    'bank_category',
    'rule_used',
    'notes',
    'transaction_key',
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Translate a legacy categorized CSV into current ingest JSONL.'
    )
    parser.add_argument(
        '--input',
        required=True,
        type=Path,
        help='Path to a legacy CSV file',
    )
    parser.add_argument(
        '--output',
        type=Path,
        default=None,
        help='Output JSONL path (default: <csv_stem>_ingested.jsonl next to the CSV)',
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite an existing output JSONL file',
    )
    return parser.parse_args()


def cell(row: dict, name: str) -> str:
    value = row.get(name, '')
    if value is None:
        return ''
    return str(value).strip()


def translate_row(row: dict, source_file: str, row_number: int) -> dict | None:
    date = normalize_iso_date(cell(row, 'date'))
    amount = parse_number(cell(row, 'amount'))
    account = cell(row, 'account')
    description = cell(row, 'description')
    bank_category = cell(row, 'bank_category')
    transaction_key = cell(row, 'transaction_key') or uuidv4()

    if not date or not description or not account or is_nan(amount):
        return None

    return {
        'key': transaction_key,
        'source_file': source_file,
        'source_row_number': row_number,
        'date': date,
        'amount': amount,
        'account': account,
        'description': description,
        'bank_category': bank_category,
        'raw': dict(row),
    }


def main() -> None:
    args = parse_args()
    input_path = args.input.expanduser().resolve()
    if not input_path.is_file():
        raise SystemExit(f'Input CSV not found: {input_path}')
    if input_path.suffix.lower() != '.csv':
        raise SystemExit(f'Input must be a .csv file: {input_path}')

    output_path = (
        args.output.expanduser().resolve()
        if args.output is not None
        else input_path.with_name(f'{input_path.stem}_ingested.jsonl')
    )

    if output_path.exists() and not args.force:
        raise SystemExit(f'Output already exists: {output_path}. Use --force to overwrite.')

    rows = parse_csv_rows(input_path.read_text(encoding='utf-8-sig'))
    if not rows:
        raise SystemExit(f'No data rows found in {input_path}')

    header_keys = {str(key).strip().lower() for key in rows[0].keys()}
    normalized_first = {str(k).strip().lower(): str(k) for k in rows[0].keys()}
    missing = [col for col in REQUIRED_COLUMNS if col not in normalized_first]
    if missing:
        raise SystemExit(
            f'Legacy CSV missing required column(s): {", ".join(missing)}. '
            f'Found: {", ".join(sorted(header_keys))}'
        )

    canonical_rows: list[dict] = []
    for row in rows:
        remapped = {}
        for key, value in row.items():
            remapped[str(key).strip().lower()] = value
        canonical_rows.append(remapped)

    records: list[dict] = []
    skipped = 0
    source_name = input_path.name

    for index, row in enumerate(canonical_rows, start=2):
        record = translate_row(row, source_name, index)
        if record is None:
            skipped += 1
            continue
        records.append(record)

    if not records:
        raise SystemExit(f'No valid rows translated from {input_path}')

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        '\n'.join(json.dumps(record, ensure_ascii=False) for record in records) + '\n',
        encoding='utf-8',
    )
    print(f'Wrote {len(records)} ingested record(s) to {output_path}')
    if skipped:
        print(f'Skipped {skipped} row(s) missing date/description/account/amount')


if __name__ == '__main__':
    main()
