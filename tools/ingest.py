#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from utils import (
    get_string_field,
    load_allowed_accounts,
    normalize_iso_date,
    parse_csv_rows,
    parse_row_amount,
    resolve_account_for_source_file,
    uuidv4,
)


def parse_args():
    parser = argparse.ArgumentParser(description='Ingest bank export files into immutable JSONL records.')
    parser.add_argument('--input', required=True, help='Directory containing exported transaction files')
    parser.add_argument('--force', action='store_true', help='Overwrite an existing ingest file')
    parser.add_argument(
        '--account',
        help='Force a single allowlisted account for every source file in this ingest run',
    )
    return parser.parse_args()


def parse_row(row: dict, file_name: str, row_number: int, account: str) -> dict:
    date = normalize_iso_date(get_string_field(row, ['Date', 'Transaction Date', 'Posted Date', 'date', 'post date']))
    amount = parse_row_amount(row)
    description = get_string_field(row, ['Description', 'Payee', 'Merchant', 'Summary', 'description'])
    bank_category = get_string_field(row, ['Category', 'bank_category', 'CategoryName'])
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

    allowed_accounts = load_allowed_accounts()
    forced_account = None
    if args.account:
        if args.account not in allowed_accounts:
            raise SystemExit(
                f"--account '{args.account}' is not in allowed-accounts.json. "
                f'Allowed: {", ".join(allowed_accounts)}'
            )
        forced_account = args.account

    ingest_file_name = f'import_{int(__import__("time").time())}_ingested.jsonl'
    ingest_path = input_path / ingest_file_name
    if ingest_path.exists() and not args.force:
        raise SystemExit(f'Ingest file already exists: {ingest_path}. Use --force to overwrite.')

    # Resolve once per source file: each file is a single account.
    file_accounts: dict[Path, str] = {}
    for file_path in files:
        if forced_account:
            account = forced_account
        else:
            account = resolve_account_for_source_file(str(file_path), allowed_accounts)
        file_accounts[file_path] = account
        print(f'{file_path.name} -> {account}')

    rows = []
    skipped = 0
    for file_path in files:
        account = file_accounts[file_path]
        content = file_path.read_text(encoding='utf-8')
        parsed_rows = parse_csv_rows(content)
        for index, row in enumerate(parsed_rows, start=2):
            record = parse_row(row, str(file_path), index, account=account)
            if not record['date'] or record['description'] == '' or isinstance(record['amount'], float) and record['amount'] != record['amount']:
                skipped += 1
                continue
            rows.append(record)

    ingest_path.write_text('\n'.join(json.dumps(record, ensure_ascii=False) for record in rows) + '\n', encoding='utf-8')
    print(f'Wrote {len(rows)} ingested records to {ingest_path}')
    if skipped:
        print(f'Skipped {skipped} rows missing date/description/amount')


if __name__ == '__main__':
    main()
