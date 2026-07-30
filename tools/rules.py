#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path

from utils import append_rule, apply_to_accounts_allowlist, flatten_rules, get_rules_path, load_rules_data, strip_trailing_end_anchor


def parse_args():
    parser = argparse.ArgumentParser(description='Manage categorization rules for transaction ingestion.')
    subparsers = parser.add_subparsers(dest='command')

    subparsers.add_parser('list', help='List existing rules')

    add_parser = subparsers.add_parser('add', help='Add a new rule')
    add_parser.add_argument('--regex', required=True, help='Regex pattern for matching transaction text')
    add_parser.add_argument('--category', required=True, help='Category to assign, in major:minor format')
    add_parser.add_argument('--notes', default='', help='Optional note to attach to the rule')

    preview_parser = subparsers.add_parser('preview', help='Preview matching rules against sample text')
    preview_parser.add_argument('--sample', required=True, help='Sample description text to test rules')

    return parser.parse_args()


def main():
    args = parse_args()
    rules_path = Path(get_rules_path())
    rules = load_rules_data()
    all_rules = flatten_rules(rules)

    if args.command == 'list':
        if not all_rules:
            print('No rules defined yet.')
            return
        for category_key in sorted(rules):
            bucket = rules.get(category_key) or []
            if not isinstance(bucket, list):
                continue
            print(f"Category: {category_key}")
            for rule in bucket:
                note_display = f" notes={rule.get('notes')}" if rule.get('notes') else ''
                print(f"  {rule.get('id')}: /{rule.get('regex')}/{note_display}")
        return

    if args.command == 'add':
        rule = {
            'id': f'rule_{int(__import__('time').time())}',
            'regex': args.regex,
            'category': args.category,
            'created_at': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
            'created_by': 'manual',
            'notes': args.notes or '',
            'apply_to_accounts': None,
        }
        try:
            append_rule(rule, persist=True)
        except json.JSONDecodeError as exc:
            raise SystemExit(f'Cannot add rule: {rules_path} is not valid JSON ({exc}).') from exc
        print(f'Added rule {rule["id"]}')
        if rule['notes']:
            print(f"Rule note: {rule['notes']}")
        return

    if args.command == 'preview':
        matches = []
        for rule in all_rules:
            if apply_to_accounts_allowlist(rule) is not None:
                # Without an account in --sample, account-scoped rules cannot match.
                continue
            try:
                pattern = strip_trailing_end_anchor(rule.get('regex', ''))
                if re.search(pattern, args.sample, re.IGNORECASE):
                    matches.append(rule)
            except re.error:
                continue
        if not matches:
            print('No matching rules.')
            return
        for rule in matches:
            print(f"{rule.get('id')}: /{rule.get('regex')}/ => {rule.get('category')}")
        return

    print('Usage: python rules.py list | add | preview')
    sys.exit(1)


if __name__ == '__main__':
    main()
