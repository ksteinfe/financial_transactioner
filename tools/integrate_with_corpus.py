#!/usr/bin/env python3
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

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


def parse_args():
    parser = argparse.ArgumentParser(description='Integrate ingested records into the local corpus.')
    parser.add_argument('--input', required=True, help='Ingest folder or ingested JSONL file')
    parser.add_argument('--dry-run', action='store_true', help='Do not write corpus files')
    parser.add_argument('--persist-rules', action='store_true', help='When used with --dry-run, persist new rules while still skipping corpus writes')
    return parser.parse_args()


def prompt(question: str) -> str:
    return input(question).strip()


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


def print_task_metadata(input_file: Path, total_records: int, dry_run: bool, corpus_dir: Path, rule_count: int):
    print('\n' + '=' * 80)
    print('Corpus integration task')
    print('-' * 80)
    print(f'Input: {input_file.name}')
    print(f'Total transactions found: {total_records}')
    print(f'Corpus root: {corpus_dir}')
    print(f'Dry run: {dry_run}')
    print(f'Loaded rules: {rule_count}')
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


def file_contains_transaction_key(corpus_root: Path, key: str, year: str | None):
    candidates = []
    if year:
        candidates.append(corpus_root / f'{year}.json')
    if corpus_root.is_dir():
        for entry in corpus_root.iterdir():
            if entry.is_file() and entry.suffix == '.json' and entry not in candidates:
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
        'source_key': record['key'],
    }
    notes = []
    if record.get('bank_category'):
        notes.append(f"bank_category={record['bank_category']}")
    if rule_note:
        notes.append(rule_note)
    if notes:
        tx['notes'] = '; '.join(notes)
    return tx


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

    initial_rules = flatten_rules(load_rules_data())
    pending_year_files: dict[Path, dict] = {}
    pending_integration_count = 0

    print_task_metadata(ingested_file, len(records), args.dry_run, corpus_dir, len(initial_rules))

    applied_count = 0
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
        if file_contains_transaction_key(corpus_dir, record['key'], year):
            print(f"Skipping already-integrated record {record['key']}")
            continue

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
        save_rule = False

        applied_rule_note = None
        if isinstance(selected_rule, dict):
            category = selected_rule.get('category')
            applied_rule_note = selected_rule.get('notes')
            print(f"Applying rule {selected_rule.get('id')} => {category} for record {index}/{len(records)}")
            if applied_rule_note:
                print(f"Rule note: {applied_rule_note}")
        elif isinstance(selected_rule, list):
            print(f"Multiple matching rules for record {index}/{len(records)}. Please choose:")
            for choice_index, rule in enumerate(selected_rule, start=1):
                note_display = f" notes={rule.get('notes')}" if rule.get('notes') else ''
                print(f"{choice_index}. {rule.get('id')} /{rule.get('regex')}/ => {rule.get('category')}{note_display}")
            answer = prompt('Choose rule number or press Enter to skip: ')
            if answer.isdigit():
                choice = int(answer)
                if 1 <= choice <= len(selected_rule):
                    selected = selected_rule[choice - 1]
                    category = selected.get('category')
                    applied_rule_note = selected.get('notes')
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

                category_answer = prompt('Choose category option number, enter a category manually, or press Enter to defer category: ')
                if category_answer.isdigit():
                    category_index = int(category_answer)
                    if 1 <= category_index <= len(category_choices):
                        category = category_choices[category_index - 1]
                elif category_answer:
                    candidate = category_answer.strip()
                    allowed_categories = load_allowed_categories()
                    while candidate and candidate not in allowed_categories:
                        print(f"Category '{candidate}' is not in allowed categories.")
                        category_answer = prompt('Enter a valid category in major:minor format or press Enter to defer category: ')
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
                    regex_answer = prompt(
                        f'Choose option 1-{refresh_choice}, enter a regex manually, or press Enter to skip rule creation: '
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
                        save_rule = save.lower().startswith('y')
                        if save_rule:
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
            answer = prompt('Enter category manually (major:minor) or press Enter to defer and use unknown:undefined: ')
            if answer:
                category = answer.strip()
            else:
                category = 'unknown:undefined'
                print(f"Deferring category decision; applying {category} for record {record['key']}")

        corpus_transaction = build_corpus_transaction(record, category, applied_rule_note)
        target_year = corpus_transaction['date'][:4]
        year_file_path = corpus_dir / f'{target_year}.json'
        year_file = pending_year_files.get(year_file_path)
        if year_file is None:
            if year_file_path.exists():
                try:
                    year_file = json.loads(year_file_path.read_text(encoding='utf-8'))
                except json.JSONDecodeError:
                    print(f'Warning: could not parse existing year file {year_file_path}, replacing it.')
                    year_file = {}
            else:
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
        pending_integration_count += 1

        print(f"Prepared record {record['key']} for integration into {year_file_path}")

        applied_count += 1

    if pending_integration_count:
        if args.dry_run:
            if args.persist_rules:
                print(f"Dry run (partial): prepared {pending_integration_count} records for integration. Rules were persisted; corpus writes were skipped.")
            else:
                print(f"Dry run (full): prepared {pending_integration_count} records for integration. No rules were persisted and corpus writes were skipped.")
        else:
            confirm = prompt(f'\nReady to integrate {pending_integration_count} records into corpus. Confirm? [Y/n] ') or 'y'
            if confirm.lower().startswith('y'):
                for year_file_path, year_file in pending_year_files.items():
                    write_json_file(year_file_path, year_file)
                    print(f"Wrote {year_file_path} ({len(year_file.get('transactions', []))} records)")
                print(f"Integrated {pending_integration_count} records into corpus.")
            else:
                print(f"Skipped writing {pending_integration_count} records to corpus.")
    else:
        print('No records were prepared for corpus integration.')

    print(f"Processed {applied_count} records from {ingested_file.name}")


if __name__ == '__main__':
    main()
