#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path

from utils import (
    get_string_field,
    load_dotenv,
    normalize_account_from_file_name,
    normalize_iso_date,
    parse_csv_rows,
    parse_row_amount,
    uuidv4,
)


def parse_args():
    parser = argparse.ArgumentParser(description='Ingest bank export files into immutable JSONL records.')
    parser.add_argument('--input', required=True, help='Directory containing exported transaction files')
    parser.add_argument('--force', action='store_true', help='Overwrite an existing ingest file')
    return parser.parse_args()


def parse_row(row: dict, file_name: str, row_number: int) -> dict:
    date = normalize_iso_date(get_string_field(row, ['Date', 'Transaction Date', 'Posted Date', 'date', 'post date']))
    amount = parse_row_amount(row)
    description = get_string_field(row, ['Description', 'Payee', 'Merchant', 'Summary', 'description'])
    bank_category = get_string_field(row, ['Category', 'bank_category', 'CategoryName'])
    account = get_string_field(row, ['Account', 'Card No.', 'card', 'account']) or normalize_account_from_file_name(file_name)
    return {
        'key': uuidv4(),
        'source_file': Path(file_name).name,
        'source_row_number': row_number,
        'date': date,
        'amount': amount,
        'account': account,
        'description': description,
        'bank_category': bank_category,
        'raw': row,
    }


def find_input_files(input_path: Path):
    return [
        entry for entry in input_path.iterdir()
        if entry.is_file() and entry.suffix.lower() in {'.csv', '.ofx', '.qfx'}
    ]


def main():
    args = parse_args()
    input_path = Path(args.input).resolve()
    if not input_path.is_dir():
        raise SystemExit(f'Input path must be a directory: {input_path}')

    files = find_input_files(input_path)
    if not files:
        raise SystemExit(f'No supported transaction files found in {input_path}')

    ingest_file_name = f'import_{int(__import__("time").time())}_ingested.jsonl'
    ingest_path = input_path / ingest_file_name
    if ingest_path.exists() and not args.force:
        raise SystemExit(f'Ingest file already exists: {ingest_path}. Use --force to overwrite.')

    rows = []
    skipped = 0
    for file_path in files:
        content = file_path.read_text(encoding='utf-8')
        parsed_rows = parse_csv_rows(content)
        for index, row in enumerate(parsed_rows, start=2):
            record = parse_row(row, str(file_path), index)
            if not record['date'] or record['description'] == '' or isinstance(record['amount'], float) and record['amount'] != record['amount']:
                skipped += 1
                continue
            rows.append(record)

    ingest_path.write_text('\n'.join(json.dumps(record, ensure_ascii=False) for record in rows) + '\n', encoding='utf-8')
    print(f'Wrote {len(rows)} ingested records to {ingest_path}')


if __name__ == '__main__':
    main()
