#!/usr/bin/env python3
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from corpus_summary import CORPUS_SUMMARY_FILENAME, iter_year_json_files, rebuild_corpus_summary
from utils import (
    append_rule,
    flatten_rules,
    load_dotenv,
    load_rules_data,
    resolve_repo_root,
    rule_matches_record,
    sort_rules_by_specificity,
    strip_trailing_end_anchor,
    write_json_file,
)
from llm import (
    format_regex_option,
    load_allowed_categories,
    regex_option_pattern,
    suggest_category_and_rule,
    suggest_regex_options,
)


class QuitIntegration(Exception):
    """Raised when the user asks to stop mid-integration."""


def parse_args():
    parser = argparse.ArgumentParser(description='Integrate ingested records into the local corpus.')
    parser.add_argument('--input', required=True, help='Ingest folder or ingested JSONL file')
    parser.add_argument('--dry-run', action='store_true', help='Do not write corpus files')
    parser.add_argument('--persist-rules', action='store_true', help='When used with --dry-run, persist new rules while still skipping corpus writes')
    return parser.parse_args()


def prompt(question: str) -> str:
    return input(question).strip()


def quit_requested(answer: str) -> bool:
    return answer.strip().lower() in {'q', 'quit'}


def prompt_or_quit(question: str) -> str:
    answer = prompt(question)
    if quit_requested(answer):
        raise QuitIntegration()
    return answer


def format_transaction_summary(record: dict) -> str:
    amount = record.get('amount')
    amount_str = f"${amount:,.2f}" if isinstance(amount, (int, float)) else str(amount)
    summary_lines = [
        f"Date: {record.get('date', '<missing>')}  Amount: {amount_str}  Account: {record.get('account', '<missing>')}",
        f"Description: {record.get('description', '<missing>')}"
    ]
    if record.get('bank_category'):
        summary_lines.append(f"Bank category: {record.get('bank_category')}")
    if record.get('source_file'):
        summary_lines.append(f"Source file: {record.get('source_file')}")
    return '\n'.join(summary_lines)


def print_task_metadata(
    input_file: Path,
    total_records: int,
    dry_run: bool,
    corpus_dir: Path,
    rule_count: int,
    progress_count: int,
    progress_path: Path,
):
    print('\n' + '=' * 80)
    print('Corpus integration task')
    print('-' * 80)
    print(f'Input: {input_file.name}')
    print(f'Total transactions found: {total_records}')
    print(f'Corpus root: {corpus_dir}')
    print(f'Dry run: {dry_run}')
    print(f'Loaded rules: {rule_count}')
    if progress_count:
        print(f'Resuming: {progress_count} categorizations in {progress_path.name}')
    else:
        print(f'Progress file: {progress_path.name} (none yet)')
    print('Tip: type q at categorization prompts, or Ctrl+C, to stop and resume later.')
    print('=' * 80 + '\n')


def parse_input_file_path(input_path: Path) -> Path:
    if input_path.is_file():
        return input_path
    if input_path.is_dir():
        matches = [p for p in input_path.iterdir() if p.name.endswith('_ingested.jsonl') or p.name.endswith('_ingested.json')]
        if not matches:
            raise SystemExit(f'No ingested file found in {input_path}')
        return matches[0]
    raise SystemExit(f'Input must be a file or directory: {input_path}')


def read_jsonl(file_path: Path):
    text = file_path.read_text(encoding='utf-8')
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def progress_path_for(ingested_file: Path) -> Path:
    return ingested_file.with_name(f'{ingested_file.stem}.progress.json')


def empty_progress(ingested_file: Path) -> dict:
    return {
        'source_file': ingested_file.name,
        'updated_at': datetime.now(timezone.utc).isoformat(),
        'categorizations': {},
    }


def load_progress(path: Path, ingested_file: Path) -> dict:
    if not path.exists():
        return empty_progress(ingested_file)
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        print(f'Warning: could not parse progress file {path}; starting a fresh progress file.')
        return empty_progress(ingested_file)
    if not isinstance(data, dict):
        return empty_progress(ingested_file)
    categorizations = data.get('categorizations')
    if not isinstance(categorizations, dict):
        categorizations = {}
    return {
        'source_file': data.get('source_file') or ingested_file.name,
        'updated_at': data.get('updated_at') or datetime.now(timezone.utc).isoformat(),
        'categorizations': categorizations,
    }


def save_progress(path: Path, progress: dict):
    progress['updated_at'] = datetime.now(timezone.utc).isoformat()
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + '.tmp')
    temp_path.write_text(json.dumps(progress, indent=2) + '\n', encoding='utf-8')
    temp_path.replace(path)


def record_categorization(
    progress: dict,
    progress_path: Path,
    key: str,
    category: str,
    rule_id: str | None = None,
    rule_note: str | None = None,
):
    progress.setdefault('categorizations', {})[key] = {
        'category': category,
        'rule_id': rule_id,
        'rule_note': rule_note,
        'decided_at': datetime.now(timezone.utc).isoformat(),
    }
    save_progress(progress_path, progress)


def delete_progress_file(path: Path):
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:
        print(f'Warning: could not delete progress file {path}: {exc}')


def rule_applies(rule: dict, record: dict) -> bool:
    return rule_matches_record(rule, record)


def choose_rule(rules: list, record: dict):
    matches = [rule for rule in rules if rule_applies(rule, record)]
    if not matches:
        return None
    sorted_matches = sort_rules_by_specificity(matches)
    if len(sorted_matches) == 1:
        return sorted_matches[0]
    if sorted_matches[0].get('category') == sorted_matches[1].get('category'):
        return sorted_matches[0]
    return sorted_matches


def load_existing_corpus_keys(corpus_root: Path) -> set[str]:
    """Load every transaction key already present in the corpus (once)."""
    keys: set[str] = set()
    files = iter_year_json_files(corpus_root)
    if not files:
        print(f'No corpus year files found under {corpus_root}')
        return keys
    print(f'Scanning {len(files)} corpus file(s) for existing transaction keys...')
    for index, path in enumerate(files, start=1):
        print(f'  [{index}/{len(files)}] Reading {path.name}...', end='', flush=True)
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
        except (FileNotFoundError, json.JSONDecodeError) as exc:
            print(f' skipped ({exc})')
            continue
        transactions = data.get('transactions', []) if isinstance(data, dict) else []
        before = len(keys)
        for tx in transactions:
            if isinstance(tx, dict):
                key = tx.get('key')
                if isinstance(key, str) and key:
                    keys.add(key)
        print(f' {len(transactions)} transactions ({len(keys) - before} new keys)')
    print(f'Loaded {len(keys)} existing corpus key(s).')
    return keys


def file_contains_transaction_key(
    corpus_root: Path,
    key: str,
    year: str | None,
    existing_keys: set[str] | None = None,
):
    if existing_keys is not None:
        return key in existing_keys
    candidates = []
    if year:
        candidates.append(corpus_root / f'{year}.json')
    for entry in iter_year_json_files(corpus_root):
        if entry not in candidates:
            candidates.append(entry)
    for candidate in candidates:
        try:
            data = json.loads(candidate.read_text(encoding='utf-8'))
        except (FileNotFoundError, json.JSONDecodeError):
            continue
        transactions = data.get('transactions', []) if isinstance(data, dict) else []
        if any(tx.get('key') == key for tx in transactions if isinstance(tx, dict)):
            return True
    return False


def build_corpus_transaction(record: dict, category: str, rule_note: str | None = None) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    tx = {
        'key': record['key'],
        'date': record['date'],
        'amount': record['amount'],
        'account': record['account'],
        'description': record['description'],
        'category': category,
        'date_created': now,
        'date_updated': now,
    }
    notes = []
    if record.get('bank_category'):
        notes.append(f"bank_category={record['bank_category']}")
    if rule_note:
        notes.append(rule_note)
    if notes:
        tx['notes'] = '; '.join(notes)
    return tx


def add_to_pending_year_files(
    pending_year_files: dict[Path, dict],
    corpus_dir: Path,
    ingested_file: Path,
    corpus_transaction: dict,
) -> Path:
    target_year = corpus_transaction['date'][:4]
    year_file_path = corpus_dir / f'{target_year}.json'
    year_file = pending_year_files.get(year_file_path)
    if year_file is None:
        if year_file_path.exists():
            print(f'  Loading existing year file into memory: {year_file_path.name}...', flush=True)
            try:
                year_file = json.loads(year_file_path.read_text(encoding='utf-8'))
                existing_count = len(year_file.get('transactions', [])) if isinstance(year_file, dict) else 0
                print(f'    loaded {existing_count} existing transaction(s) from {year_file_path.name}', flush=True)
            except json.JSONDecodeError:
                print(f'Warning: could not parse existing year file {year_file_path}, replacing it.')
                year_file = {}
        else:
            print(f'  Creating new year file in memory: {year_file_path.name}', flush=True)
            year_file = {}
        pending_year_files[year_file_path] = year_file

    metadata = year_file.get('metadata', {})
    metadata.setdefault('last_sync_date', datetime.now(timezone.utc).isoformat())
    metadata.setdefault('sources', [])
    metadata.setdefault('last_push_date', datetime.now(timezone.utc).isoformat())
    if year_file.get('metadata') is None:
        year_file['metadata'] = metadata

    if year_file['metadata'].get('sources') is None:
        year_file['metadata']['sources'] = []
    source_name = Path(ingested_file).parent.name
    if source_name not in year_file['metadata']['sources']:
        year_file['metadata']['sources'].append(source_name)
    year_file['metadata']['last_sync_date'] = datetime.now(timezone.utc).isoformat()

    year_file.setdefault('transactions', [])
    year_file['transactions'].append(corpus_transaction)
    return year_file_path


def rebuild_pending_from_progress(
    records: list,
    progress: dict,
    corpus_dir: Path,
    ingested_file: Path,
    existing_keys: set[str] | None = None,
) -> tuple[dict[Path, dict], int]:
    """Rebuild corpus pending batch from all progress entries for this ingest."""
    records_by_key = {
        record['key']: record
        for record in records
        if isinstance(record.get('key'), str)
    }
    pending_year_files: dict[Path, dict] = {}
    queued_by_year: dict[str, int] = {}
    count = 0
    skipped_existing = 0
    skipped_invalid = 0
    categorizations = progress.get('categorizations') or {}
    total = len(categorizations)
    print(f'\nBuilding pending corpus batch from {total} saved categorization(s)...')
    if existing_keys is None:
        print('Loading existing corpus keys for duplicate checks...')
        existing_keys = load_existing_corpus_keys(corpus_dir)

    for index, (key, decision) in enumerate(categorizations.items(), start=1):
        if index == 1 or index == total or index % 100 == 0:
            print(
                f'  Pending rebuild progress: {index}/{total} '
                f'(queued={count}, already_in_corpus={skipped_existing})',
                flush=True,
            )
        record = records_by_key.get(key)
        if record is None:
            skipped_invalid += 1
            continue
        amount = record.get('amount')
        if not record.get('date') or amount is None or isinstance(amount, float) and amount != amount or not record.get('account') or not record.get('description'):
            skipped_invalid += 1
            continue
        year = record['date'][:4]
        if file_contains_transaction_key(corpus_dir, key, year, existing_keys):
            skipped_existing += 1
            continue
        category = decision.get('category')
        if not category:
            skipped_invalid += 1
            continue
        corpus_transaction = build_corpus_transaction(
            record,
            category,
            decision.get('rule_note'),
        )
        year_path = add_to_pending_year_files(pending_year_files, corpus_dir, ingested_file, corpus_transaction)
        queued_by_year[year_path.name] = queued_by_year.get(year_path.name, 0) + 1
        count += 1

    year_summary = ', '.join(
        f'{name}:+{queued}' for name, queued in sorted(queued_by_year.items())
    ) or '(none)'
    print(
        f'Pending rebuild complete: queued={count}, '
        f'already_in_corpus={skipped_existing}, skipped_invalid={skipped_invalid}'
    )
    if pending_year_files:
        print(f'  Newly queued by year file: {year_summary}')
        print('  Loading/merging year documents into memory finished; prompting for confirmation...')
    return pending_year_files, count


def decide_category_for_record(record: dict, index: int, total: int, args) -> tuple[str, str | None, str | None]:
    """Interactive categorization. Returns (category, rule_id, rule_note)."""
    try:
        rules = flatten_rules(load_rules_data(strict=True))
    except json.JSONDecodeError as exc:
        print(
            f'Warning: rules.json is not valid JSON ({exc}); '
            'skipping rule matching for this record until the file is fixed.'
        )
        rules = []

    selected_rule = choose_rule(rules, record)
    category = None
    applied_rule_note = None
    applied_rule_id = None

    if isinstance(selected_rule, dict):
        category = selected_rule.get('category')
        applied_rule_note = selected_rule.get('notes')
        applied_rule_id = selected_rule.get('id')
        print(f"Applying rule {applied_rule_id} => {category} for record {index}/{total}")
        if applied_rule_note:
            print(f"Rule note: {applied_rule_note}")
    elif isinstance(selected_rule, list):
        print(f"Multiple matching rules for record {index}/{total}. Please choose:")
        for choice_index, rule in enumerate(selected_rule, start=1):
            note_display = f" notes={rule.get('notes')}" if rule.get('notes') else ''
            print(f"{choice_index}. {rule.get('id')} /{rule.get('regex')}/ => {rule.get('category')}{note_display}")
        answer = prompt_or_quit('Choose rule number, press Enter to skip, or q to quit: ')
        if answer.isdigit():
            choice = int(answer)
            if 1 <= choice <= len(selected_rule):
                selected = selected_rule[choice - 1]
                category = selected.get('category')
                applied_rule_note = selected.get('notes')
                applied_rule_id = selected.get('id')
                if applied_rule_note:
                    print(f"Selected rule note: {applied_rule_note}")

    if not category:
        suggestion = suggest_category_and_rule(record)
        if suggestion is None:
            print('\nLLM suggestion unavailable or invalid; manual category entry is required.')
        category_choices = suggestion.get('categories') if suggestion else None
        regex_choices = suggestion.get('regex_options') if suggestion else None
        if category_choices:
            print('\nSuggested LLM categorization')
            print('-' * 80)
            print(format_transaction_summary(record))
            print('\nCategory options:')
            for choice_index, choice_value in enumerate(category_choices, start=1):
                print(f"  {choice_index}. {choice_value}")
            print('-' * 80)

            category_answer = prompt_or_quit(
                'Choose category option number, enter a category manually, press Enter to defer, or q to quit: '
            )
            if category_answer.isdigit():
                category_index = int(category_answer)
                if 1 <= category_index <= len(category_choices):
                    category = category_choices[category_index - 1]
            elif category_answer:
                candidate = category_answer.strip()
                allowed_categories = load_allowed_categories()
                while candidate and candidate not in allowed_categories:
                    print(f"Category '{candidate}' is not in allowed categories.")
                    category_answer = prompt_or_quit(
                        'Enter a valid category in major:minor format, press Enter to defer, or q to quit: '
                    )
                    candidate = category_answer.strip()
                if candidate:
                    category = candidate
            else:
                category = 'unknown:undefined'
                print(f"Deferring category decision; applying {category} for record {record['key']}")

        if category and category != 'unknown:undefined' and regex_choices:
            while True:
                print('\nRegex options:')
                for choice_index, choice_value in enumerate(regex_choices, start=1):
                    print(f"  {choice_index}. {format_regex_option(choice_value)}")
                refresh_choice = len(regex_choices) + 1
                print(f"  {refresh_choice}. Request different regex options from LLM")
                print('-' * 80)
                regex_answer = prompt_or_quit(
                    f'Choose option 1-{refresh_choice}, enter a regex manually, press Enter to skip rule creation, or q to quit: '
                )
                chosen_regex = None
                if regex_answer.isdigit():
                    regex_index = int(regex_answer)
                    if regex_index == refresh_choice:
                        print('Requesting different regex options from LLM...')
                        refreshed = suggest_regex_options(record, previous_options=regex_choices)
                        if refreshed:
                            regex_choices = refreshed
                        else:
                            print('Could not get new regex options; keeping current list.')
                        continue
                    if 1 <= regex_index <= len(regex_choices):
                        chosen_regex = regex_option_pattern(regex_choices[regex_index - 1])
                elif regex_answer:
                    chosen_regex = strip_trailing_end_anchor(regex_answer.strip())

                if chosen_regex:
                    save = prompt('Save this categorization and regex as a new rule? [Y/n] ') or 'y'
                    if save.lower().startswith('y'):
                        note_for_rule = prompt('Enter an optional note for this new rule: ').strip()
                        new_rule = {
                            'id': f'rule_{int(__import__('time').time())}',
                            'regex': chosen_regex,
                            'category': category,
                            'created_at': datetime.now(timezone.utc).isoformat(),
                            'created_by': 'llm',
                            'notes': note_for_rule,
                            'apply_to_accounts': None,
                        }
                        should_persist = not args.dry_run or args.persist_rules
                        try:
                            append_rule(new_rule, persist=should_persist)
                        except json.JSONDecodeError as exc:
                            print(
                                f'Could not save rule {new_rule["id"]}: rules.json is not valid JSON ({exc}). '
                                'Fix the file and re-save this rule.'
                            )
                        else:
                            if should_persist:
                                print(f"Saved new rule {new_rule['id']}")
                            else:
                                print(f"Dry run: would have saved rule {new_rule['id']} (not persisting)")
                            if note_for_rule:
                                print(f"Rule note: {note_for_rule}")
                break

    if not category:
        answer = prompt_or_quit(
            'Enter category manually (major:minor), press Enter to defer and use unknown:undefined, or q to quit: '
        )
        if answer:
            category = answer.strip()
        else:
            category = 'unknown:undefined'
            print(f"Deferring category decision; applying {category} for record {record['key']}")

    return category, applied_rule_id, applied_rule_note


def print_resume_hint(progress_path: Path):
    print(f'\nProgress saved to {progress_path}')
    print('Re-run the same integrate command with the same --input to resume.')


def main():
    args = parse_args()
    input_path = Path(args.input).resolve()
    repo_root = resolve_repo_root()
    env = load_dotenv(repo_root)
    corpus_dir = Path(env.get('TRANSACTION_CORPUS_DIR', ''))
    if not corpus_dir:
        raise SystemExit('TRANSACTION_CORPUS_DIR must be set in .env')

    openai_key = os.environ.get('OPENAI_API_KEY') or env.get('OPENAI_API_KEY')
    if not openai_key:
        print('WARNING: OPENAI_API_KEY is not set. LLM suggestions will be skipped.')

    ingested_file = parse_input_file_path(input_path)
    records = read_jsonl(ingested_file)
    if not records:
        raise SystemExit(f'No ingested records found in {ingested_file}')

    progress_path = progress_path_for(ingested_file)
    progress = load_progress(progress_path, ingested_file)
    progress_count = len(progress.get('categorizations') or {})

    initial_rules = flatten_rules(load_rules_data())
    print_task_metadata(
        ingested_file,
        len(records),
        args.dry_run,
        corpus_dir,
        len(initial_rules),
        progress_count,
        progress_path,
    )

    existing_keys = load_existing_corpus_keys(corpus_dir)

    applied_count = 0
    stopped_early = False

    try:
        for index, record in enumerate(records, start=1):
            print('\n' * 4 + '=' * 80)
            print(f'Record {index}/{len(records)}')
            print(format_transaction_summary(record))
            print('=' * 80 + '\n')
            if not isinstance(record.get('key'), str):
                print('Skipping record without key')
                continue
            amount = record.get('amount')
            if not record.get('date') or amount is None or isinstance(amount, float) and amount != amount or not record.get('account') or not record.get('description'):
                print(f"Skipping record with missing canonical fields: {record.get('key')}")
                continue

            year = record['date'][:4]
            if file_contains_transaction_key(corpus_dir, record['key'], year, existing_keys):
                print(f"Skipping already-integrated record {record['key']}")
                continue

            saved = (progress.get('categorizations') or {}).get(record['key'])
            if isinstance(saved, dict) and saved.get('category'):
                category = saved['category']
                applied_rule_note = saved.get('rule_note')
                applied_rule_id = saved.get('rule_id')
                print(f"Using saved categorization => {category} for record {record['key']}")
                if applied_rule_id:
                    print(f"Saved rule id: {applied_rule_id}")
                if applied_rule_note:
                    print(f"Saved rule note: {applied_rule_note}")
            else:
                category, applied_rule_id, applied_rule_note = decide_category_for_record(
                    record, index, len(records), args
                )
                record_categorization(
                    progress,
                    progress_path,
                    record['key'],
                    category,
                    applied_rule_id,
                    applied_rule_note,
                )
                print(f"Saved categorization for {record['key']} to {progress_path.name}")

            print(f"Prepared record {record['key']} for integration")
            applied_count += 1

    except (QuitIntegration, KeyboardInterrupt, EOFError):
        stopped_early = True
        print('\nStopped before finishing all records.')
        print_resume_hint(progress_path)
        print(f"Processed {applied_count} records from {ingested_file.name} this session.")
        return

    print('\nAll records categorized. Preparing corpus write batch...')
    pending_year_files, pending_integration_count = rebuild_pending_from_progress(
        records, progress, corpus_dir, ingested_file, existing_keys
    )

    if pending_integration_count:
        if args.dry_run:
            if args.persist_rules:
                print(
                    f"Dry run (partial): prepared {pending_integration_count} records for integration. "
                    f"Rules were persisted; corpus writes were skipped. Progress kept at {progress_path.name}."
                )
            else:
                print(
                    f"Dry run (full): prepared {pending_integration_count} records for integration. "
                    f"No rules were persisted and corpus writes were skipped. Progress kept at {progress_path.name}."
                )
        else:
            confirm = prompt(
                f'\nReady to integrate {pending_integration_count} records into corpus. Confirm? [Y/n] '
            ) or 'y'
            if confirm.lower().startswith('y'):
                for year_file_path, year_file in pending_year_files.items():
                    write_json_file(year_file_path, year_file)
                    print(f"Wrote {year_file_path} ({len(year_file.get('transactions', []))} records)")
                print(f"Integrated {pending_integration_count} records into corpus.")
                summary_path = rebuild_corpus_summary(corpus_dir)
                print(f"Rebuilt {CORPUS_SUMMARY_FILENAME} -> {summary_path}")
                delete_progress_file(progress_path)
                print(f"Removed progress file {progress_path.name}")
            else:
                print(f"Skipped writing {pending_integration_count} records to corpus.")
                print_resume_hint(progress_path)
    else:
        print('No records were prepared for corpus integration.')
        if progress_path.exists() and not (progress.get('categorizations') or {}):
            delete_progress_file(progress_path)

    if not stopped_early:
        print(f"Processed {applied_count} records from {ingested_file.name}")


if __name__ == '__main__':
    main()
