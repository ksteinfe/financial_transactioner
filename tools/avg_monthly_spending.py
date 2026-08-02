#!/usr/bin/env python3
"""Average monthly spending per major category over a month range.

Sums outflow (spending) by major category for transactions whose `date` falls in
the inclusive month range, then divides each total by the number of months in
that range.

Usage:
  python tools/avg_monthly_spending.py --from 2024-01 --to 2025-06
  python tools/avg_monthly_spending.py --from 2024-1 --to 2024-12 --corpus-dir <path>
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

from corpus_summary import parse_category
from utils import load_dotenv, resolve_repo_root

_MONTH_RE = re.compile(r'^(\d{4})-(\d{1,2})$')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Report average monthly spending per major category for a month range.'
    )
    parser.add_argument(
        '--from',
        dest='range_from',
        required=True,
        help='Start month as YYYY-MM (inclusive)',
    )
    parser.add_argument(
        '--to',
        dest='range_to',
        required=True,
        help='End month as YYYY-MM (inclusive)',
    )
    parser.add_argument(
        '--corpus-dir',
        type=Path,
        default=None,
        help='Corpus root (defaults to TRANSACTION_CORPUS_DIR from .env)',
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Emit JSON instead of a text table',
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


def parse_year_month(value: str, flag: str) -> tuple[int, int]:
    text = value.strip()
    match = _MONTH_RE.match(text)
    if not match:
        raise SystemExit(f'{flag} must be YYYY-MM (got {value!r})')
    year = int(match.group(1))
    month = int(match.group(2))
    if month < 1 or month > 12:
        raise SystemExit(f'{flag} month must be 1-12 (got {value!r})')
    return year, month


def month_key(year: int, month: int) -> str:
    return f'{year:04d}-{month:02d}'


def iter_months(start: tuple[int, int], end: tuple[int, int]) -> list[str]:
    start_y, start_m = start
    end_y, end_m = end
    if (start_y, start_m) > (end_y, end_m):
        raise SystemExit('--from must be on or before --to')
    months: list[str] = []
    y, m = start_y, start_m
    while (y, m) <= (end_y, end_m):
        months.append(month_key(y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


def date_in_month_range(date_value: object, start_key: str, end_key: str) -> bool:
    if not isinstance(date_value, str):
        return False
    trimmed = date_value.strip()
    if len(trimmed) < 7:
        return False
    mk = trimmed[:7]
    if not re.match(r'^\d{4}-\d{2}$', mk):
        return False
    return start_key <= mk <= end_key


def years_touched(months: list[str]) -> list[str]:
    return sorted({mk[:4] for mk in months})


def main() -> int:
    args = parse_args()
    start = parse_year_month(args.range_from, '--from')
    end = parse_year_month(args.range_to, '--to')
    months = iter_months(start, end)
    month_count = len(months)
    start_key = months[0]
    end_key = months[-1]

    corpus_dir = resolve_corpus_dir(args.corpus_dir)
    if not corpus_dir.is_dir():
        raise SystemExit(f'Corpus directory not found: {corpus_dir}')

    totals: dict[str, float] = defaultdict(float)
    txn_count = 0
    spend_txn_count = 0
    skipped_years: list[str] = []

    for year in years_touched(months):
        path = corpus_dir / f'{year}.json'
        if not path.is_file():
            skipped_years.append(year)
            continue
        with path.open(encoding='utf-8') as handle:
            data = json.load(handle)
        transactions = data.get('transactions', []) if isinstance(data, dict) else []
        for txn in transactions:
            if not isinstance(txn, dict):
                continue
            if not date_in_month_range(txn.get('date'), start_key, end_key):
                continue
            txn_count += 1
            amount = txn.get('amount')
            if not isinstance(amount, (int, float)) or isinstance(amount, bool):
                continue
            if amount >= 0:
                continue
            spend_txn_count += 1
            major, _minor = parse_category(txn.get('category'))
            totals[major] += -float(amount)

    rows = []
    for major in sorted(totals.keys()):
        total = round(totals[major], 2)
        average = round(total / month_count, 2) if month_count else 0.0
        rows.append(
            {
                'major': major,
                'total_spending': total,
                'avg_monthly_spending': average,
            }
        )

    grand_total = round(sum(r['total_spending'] for r in rows), 2)
    grand_avg = round(grand_total / month_count, 2) if month_count else 0.0

    payload = {
        'corpus_dir': str(corpus_dir),
        'from': start_key,
        'to': end_key,
        'month_count': month_count,
        'months': months,
        'transaction_count_in_range': txn_count,
        'spending_transaction_count': spend_txn_count,
        'missing_year_files': skipped_years,
        'majors': rows,
        'all_majors_total_spending': grand_total,
        'all_majors_avg_monthly_spending': grand_avg,
    }

    if args.json:
        print(json.dumps(payload, indent=2))
        return 0

    print(f'Corpus:  {corpus_dir}')
    print(f'Range:   {start_key} -> {end_key}  ({month_count} month(s))')
    print(f'Txns:    {txn_count} in range, {spend_txn_count} with spending (amount < 0)')
    if skipped_years:
        print(f'Missing: {", ".join(skipped_years)}.json (treated as empty)')
    print()
    print(f'{"major":<20} {"total":>14} {"avg/month":>14}')
    print('-' * 50)
    for row in rows:
        print(
            f'{row["major"]:<20} '
            f'{row["total_spending"]:>14,.2f} '
            f'{row["avg_monthly_spending"]:>14,.2f}'
        )
    print('-' * 50)
    print(f'{"ALL":<20} {grand_total:>14,.2f} {grand_avg:>14,.2f}')
    print()
    print('Spending = sum of abs(negative amounts). Average = total / month_count.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
