"""Rebuild `corpus-summary.json` from yearly corpus files.

This is the **canonical Python entry point** for updating the derived summary.
Any tool that writes transactions MUST call `rebuild_corpus_summary` after a
successful corpus change (or invoke `tools/rebuild_corpus_summary.py`).

Contract: `docs/corpus-format.md` §9. Apps use `@txn/corpus-core` for the same
shape; keep aggregation rules aligned with that package.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CORPUS_SUMMARY_FILENAME = 'corpus-summary.json'
CORPUS_SUMMARY_SCHEMA_VERSION = '1.0'
SUMMARY_NOTE = 'This file is automatically maintained by the system. Do not edit manually.'

_YEAR_FILE_RE = re.compile(r'^(\d{4})\.json$')


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def allowed_categories_path() -> Path:
    return _repo_root() / 'reference' / 'allowed-categories.json'


def load_default_major_keys(categories_path: Path | None = None) -> list[str]:
    """Major keys from `reference/allowed-categories.json` (first segment before `:`)."""
    path = categories_path or allowed_categories_path()
    with path.open(encoding='utf-8') as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f'Expected a list in {path}')
    majors: set[str] = set()
    for item in data:
        text = str(item).strip()
        if not text:
            continue
        major = text.split(':', 1)[0].strip() if ':' in text else text
        if major:
            majors.add(major)
    return sorted(majors)


def parse_category(category: Any) -> tuple[str, str]:
    """Split `major:minor`; missing `:` -> (`unknown`, `undefined`)."""
    if not isinstance(category, str) or ':' not in category:
        return 'unknown', 'undefined'
    major, minor = category.split(':', 1)
    major = major.strip() or 'unknown'
    minor = minor.strip() or 'undefined'
    return major, minor


def month_key_from_date(date_value: Any) -> str | None:
    if not isinstance(date_value, str):
        return None
    trimmed = date_value.strip()
    if len(trimmed) < 7:
        return None
    # YYYY-MM from YYYY-MM-DD (or longer ISO)
    candidate = trimmed[:7]
    if re.match(r'^\d{4}-\d{2}$', candidate):
        return candidate
    return None


def iter_year_json_files(corpus_dir: Path) -> list[Path]:
    """Return `YYYY.json` paths under the corpus root (excludes the summary)."""
    if not corpus_dir.is_dir():
        return []
    files: list[tuple[str, Path]] = []
    for entry in corpus_dir.iterdir():
        if not entry.is_file():
            continue
        match = _YEAR_FILE_RE.match(entry.name)
        if match:
            files.append((match.group(1), entry))
    files.sort(key=lambda item: item[0])
    return [path for _, path in files]


def _empty_rollup() -> dict[str, float | int]:
    return {'inflow': 0.0, 'outflow': 0.0, 'net': 0.0, 'transaction_count': 0}


def _add_amount(rollup: dict[str, float | int], amount: float) -> None:
    if amount > 0:
        rollup['inflow'] = float(rollup['inflow']) + amount
    elif amount < 0:
        rollup['outflow'] = float(rollup['outflow']) + (-amount)
    rollup['net'] = float(rollup['net']) + amount
    rollup['transaction_count'] = int(rollup['transaction_count']) + 1


def _round2(value: float) -> float:
    return round(value * 100) / 100


def _finalize_rollup(rollup: dict[str, float | int]) -> dict[str, float | int]:
    return {
        'inflow': _round2(float(rollup['inflow'])),
        'outflow': _round2(float(rollup['outflow'])),
        'net': _round2(float(rollup['net'])),
        'transaction_count': int(rollup['transaction_count']),
    }


def _sort_keys(mapping: dict[str, Any]) -> dict[str, Any]:
    return {key: mapping[key] for key in sorted(mapping.keys())}


def compute_corpus_summary(
    corpus_dir: Path | str,
    *,
    categories_path: Path | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Aggregate all `YYYY.json` files into a summary document (does not write)."""
    root = Path(corpus_dir)
    default_majors = set(load_default_major_keys(categories_path))
    year_builders: dict[str, dict[str, Any]] = {}

    for year_path in iter_year_json_files(root):
        year = year_path.stem
        try:
            with year_path.open(encoding='utf-8') as handle:
                parsed = json.load(handle)
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(parsed, dict) or not isinstance(parsed.get('transactions'), list):
            continue

        builder = year_builders.setdefault(
            year,
            {
                'totals': _empty_rollup(),
                'months': {},
                'year_majors': {},
            },
        )

        for row in parsed['transactions']:
            if not isinstance(row, dict):
                continue
            amount = row.get('amount')
            if not isinstance(amount, (int, float)) or isinstance(amount, bool):
                continue
            amount = float(amount)
            date_value = row.get('date')
            major, minor = parse_category(row.get('category'))
            default_majors.add(major)

            _add_amount(builder['totals'], amount)

            year_major = builder['year_majors'].setdefault(
                major, {'totals': _empty_rollup(), 'minors': {}}
            )
            _add_amount(year_major['totals'], amount)
            minor_rollup = year_major['minors'].setdefault(minor, _empty_rollup())
            _add_amount(minor_rollup, amount)

            month_key = month_key_from_date(date_value)
            if not month_key:
                continue

            month_entry = builder['months'].setdefault(
                month_key, {'totals': _empty_rollup(), 'majors': {}}
            )
            _add_amount(month_entry['totals'], amount)
            for known_major in default_majors:
                month_entry['majors'].setdefault(known_major, _empty_rollup())
            major_rollup = month_entry['majors'].setdefault(major, _empty_rollup())
            _add_amount(major_rollup, amount)

    years_out: dict[str, Any] = {}
    for year_str in sorted(year_builders.keys()):
        builder = year_builders[year_str]
        months_out: dict[str, Any] = {}
        for month_key in sorted(builder['months'].keys()):
            month_entry = builder['months'][month_key]
            # Ensure full major grid (including majors discovered later in the scan).
            for known_major in default_majors:
                month_entry['majors'].setdefault(known_major, _empty_rollup())
            major_categories = {
                maj: _finalize_rollup(roll)
                for maj, roll in sorted(month_entry['majors'].items())
            }
            months_out[month_key] = {
                **_finalize_rollup(month_entry['totals']),
                'major_categories': major_categories,
            }

        year_major_categories: dict[str, Any] = {}
        for maj, block in sorted(builder['year_majors'].items()):
            minor_categories = {
                min_key: _finalize_rollup(roll)
                for min_key, roll in sorted(block['minors'].items())
            }
            year_major_categories[maj] = {
                **_finalize_rollup(block['totals']),
                'minor_categories': minor_categories,
            }

        years_out[year_str] = {
            **_finalize_rollup(builder['totals']),
            'months': _sort_keys(months_out),
            'major_categories': _sort_keys(year_major_categories),
        }

    stamp = (now or datetime.now(timezone.utc)).isoformat().replace('+00:00', 'Z')
    return {
        '_note': SUMMARY_NOTE,
        'metadata': {
            'last_updated': stamp,
            'version': CORPUS_SUMMARY_SCHEMA_VERSION,
        },
        'years': _sort_keys(years_out),
    }


def write_corpus_summary_file(corpus_dir: Path | str, document: dict[str, Any]) -> Path:
    """Write summary via temp file + atomic replace."""
    root = Path(corpus_dir)
    root.mkdir(parents=True, exist_ok=True)
    target = root / CORPUS_SUMMARY_FILENAME
    payload = json.dumps(document, indent=2) + '\n'
    fd, tmp_name = tempfile.mkstemp(prefix=f'{CORPUS_SUMMARY_FILENAME}.', suffix='.tmp', dir=str(root))
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            handle.write(payload)
        Path(tmp_name).replace(target)
    except Exception:
        try:
            Path(tmp_name).unlink(missing_ok=True)
        except OSError:
            pass
        raise
    return target


def rebuild_corpus_summary(
    corpus_dir: Path | str,
    *,
    categories_path: Path | None = None,
) -> Path:
    """Recompute and overwrite `corpus-summary.json` from the current corpus.

    Call this after any successful tool write that changes yearly transaction data.
    """
    document = compute_corpus_summary(corpus_dir, categories_path=categories_path)
    return write_corpus_summary_file(corpus_dir, document)
