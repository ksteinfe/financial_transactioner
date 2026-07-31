import csv
import io
import json
import os
import re
from pathlib import Path


def parse_args():
    return dict(arg.split("=", 1) if "=" in arg else (arg.lstrip("-"), True) for arg in os.sys.argv[1:] if arg.startswith("--"))


def uuidv4():
    import uuid

    return str(uuid.uuid4())


def load_dotenv(directory: str) -> dict:
    env_path = Path(directory) / '.env'
    try:
        raw = env_path.read_text(encoding='utf-8')
        return parse_dotenv(raw)
    except FileNotFoundError:
        return {}


def parse_dotenv(text: str) -> dict:
    env = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        env[key] = value
    return env


def resolve_repo_root() -> str:
    return str(Path(__file__).resolve().parent.parent)


def normalize_iso_date(value):
    if not isinstance(value, str):
        return ''
    trimmed = value.strip()
    if re.match(r'^\d{4}-\d{2}-\d{2}$', trimmed):
        return trimmed
    mdy_match = re.match(r'^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$', trimmed)
    if mdy_match:
        month, day, year = mdy_match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    ymd_match = re.match(r'^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$', trimmed)
    if ymd_match:
        year, month, day = ymd_match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return ''


def parse_number(value):
    if value is None:
        return float('nan')
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r'[^0-9.-]', '', str(value))
    try:
        return float(cleaned)
    except ValueError:
        return float('nan')


def parse_csv(text: str):
    reader = csv.reader(io.StringIO(text))
    return [[cell.strip() for cell in row] for row in reader]


def parse_csv_rows(text: str):
    rows = parse_csv(text)
    non_empty_rows = [row for row in rows if any(cell for cell in row)]
    if not non_empty_rows:
        return []

    known_headers = {
        'date',
        'transaction date',
        'posted date',
        'description',
        'category',
        'debit',
        'credit',
        'amount',
        'running bal.',
        'memo',
        'card no.',
        'account',
        'summary amt.',
        'type'
    }
    required_header_hints = {'date', 'transaction date', 'posted date', 'amount', 'debit', 'credit'}

    header_candidates = []
    for idx, row in enumerate(non_empty_rows):
        row_lower = [cell.lower() for cell in row]
        known_count = sum(1 for cell in row_lower if cell in known_headers)
        hint_count = sum(1 for cell in row_lower if cell in required_header_hints)
        if known_count >= 2:
            header_candidates.append((idx, row, known_count, hint_count))

    header_row_index = 0
    if header_candidates:
        preferred = next((candidate for candidate in header_candidates if candidate[3] >= 1), header_candidates[0])
        header_row_index = preferred[0]

    header = [cell.strip() for cell in non_empty_rows[header_row_index]]
    parsed = []
    for row in non_empty_rows[header_row_index + 1:]:
        record = {}
        for i, key in enumerate(header):
            record[key] = row[i] if i < len(row) else ''
        parsed.append(record)
    return parsed


def normalize_account_from_file_name(file_name: str) -> str:
    base = Path(file_name).stem.lower().replace(' ', '_').replace('-', '_')
    return re.sub(r'[^a-z0-9_]', '_', base)


def get_allowed_accounts_path() -> Path:
    return Path(resolve_repo_root()) / 'reference' / 'allowed-accounts.json'


def load_allowed_accounts() -> list[str]:
    path = get_allowed_accounts_path()
    with path.open(encoding='utf-8') as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise SystemExit(f'Expected a list in {path}')
    return [str(item).strip() for item in data if str(item).strip()]


def match_allowed_accounts_in_file_name(file_name: str, allowed_accounts: list[str] | None = None) -> list[str]:
    """Return allowlist accounts that exactly match the filename stem or its leading token(s).

    A match means the normalized stem equals the account, or starts with ``account + '_'``.
    When several allowlist entries match, only the longest ones that are not prefixes of a
    longer match are kept (e.g. ``boa_check_6934`` wins over ``boa_check``).
    """
    allowed = allowed_accounts if allowed_accounts is not None else load_allowed_accounts()
    stem = normalize_account_from_file_name(file_name)
    matches = [
        account
        for account in allowed
        if stem == account or stem.startswith(f'{account}_')
    ]
    if not matches:
        return []
    longest = max(len(account) for account in matches)
    return sorted(account for account in matches if len(account) == longest)


def prompt_account_from_allowlist(file_name: str, allowed_accounts: list[str], candidates: list[str] | None = None) -> str:
    """Ask the user which allowlist account to use for a source file."""
    display_name = Path(file_name).name
    print(f"Could not uniquely resolve account for '{display_name}' from allowlist.")
    if candidates:
        print(f'Ambiguous filename matches: {", ".join(candidates)}')
    print('Allowed accounts:')
    for index, account in enumerate(allowed_accounts, start=1):
        print(f'  {index}. {account}')
    while True:
        try:
            answer = input("Enter number, account name, or 'q' to quit: ").strip()
        except (EOFError, KeyboardInterrupt):
            raise SystemExit('Aborted account selection.')
        if not answer:
            continue
        if answer.lower() in {'q', 'quit'}:
            raise SystemExit('Aborted account selection.')
        if answer.isdigit():
            index = int(answer)
            if 1 <= index <= len(allowed_accounts):
                return allowed_accounts[index - 1]
            print(f'Choose a number between 1 and {len(allowed_accounts)}.')
            continue
        if answer in allowed_accounts:
            return answer
        print(f"'{answer}' is not in allowed-accounts.json. Pick a listed account.")


def resolve_account_for_source_file(
    file_name: str,
    allowed_accounts: list[str] | None = None,
    *,
    interactive: bool = True,
) -> str:
    """Resolve the single account for a source CSV from its filename + allowlist.

    Each source file is assumed to contain transactions for exactly one account.
    """
    allowed = allowed_accounts if allowed_accounts is not None else load_allowed_accounts()
    if not allowed:
        raise SystemExit(f'No accounts found in {get_allowed_accounts_path()}')
    matches = match_allowed_accounts_in_file_name(file_name, allowed)
    if len(matches) == 1:
        return matches[0]
    if not interactive:
        detail = ', '.join(matches) if matches else 'none'
        raise SystemExit(
            f"Could not uniquely resolve account for '{Path(file_name).name}' "
            f'(matches: {detail}). Re-run interactively or rename the file.'
        )
    return prompt_account_from_allowlist(file_name, allowed, candidates=matches or None)


def get_string_field(row: dict, names):
    for name in names:
        if name in row and isinstance(row[name], str):
            value = row[name].strip()
            if value:
                return value
    return ''


def parse_row_amount(row: dict):
    amount_field = get_string_field(row, ['Amount', 'amount', 'Transaction Amount', 'Summary Amt.', 'Debit', 'Credit'])
    if amount_field:
        debit = get_string_field(row, ['Debit'])
        credit = get_string_field(row, ['Credit'])
        if debit:
            parsed = parse_number(debit)
            return -abs(parsed) if not is_nan(parsed) else float('nan')
        if credit:
            parsed = parse_number(credit)
            return abs(parsed) if not is_nan(parsed) else float('nan')
        parsed = parse_number(amount_field)
        return parsed
    return float('nan')


def is_nan(value):
    return isinstance(value, float) and value != value


def round_amount_for_llm(amount):
    if is_nan(amount):
        return ''
    rounded = round(amount)
    if abs(rounded) < 100:
        return str(rounded)
    if abs(rounded) < 1000:
        return str(rounded - (rounded % 10))
    return str(rounded - (rounded % 50))


def read_json_file(file_path: str, default_value=None):
    try:
        with open(file_path, 'r', encoding='utf-8') as handle:
            return json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return default_value


def write_json_file(file_path: str, data):
    with open(file_path, 'w', encoding='utf-8') as handle:
        json.dump(data, handle, indent=2)
        handle.write('\n')


def category_key_for_rule(rule: dict) -> str:
    category = str(rule.get('category', '')).strip()
    if category:
        return category
    return 'unknown:undefined'


def strip_trailing_end_anchor(pattern: str) -> str:
    """Remove trailing unescaped `$` end anchors from a regex pattern.

    Matching runs against a longer canonical description, so end-of-string
    anchors are never appropriate. Escaped literal dollars (`\\$`) are kept.
    """
    if not isinstance(pattern, str):
        return ''
    cleaned = pattern.rstrip()
    while cleaned.endswith('$'):
        backslashes = 0
        index = len(cleaned) - 2
        while index >= 0 and cleaned[index] == '\\':
            backslashes += 1
            index -= 1
        if backslashes % 2 == 1:
            break
        cleaned = cleaned[:-1].rstrip()
    return cleaned


def build_canonical_description(record: dict) -> str:
    pieces = [record.get('description', ''), record.get('bank_category', ''), record.get('source_file', '')]
    return ' | '.join(piece for piece in pieces if piece)


def regex_matches_record(pattern: str, record: dict) -> bool:
    try:
        cleaned = strip_trailing_end_anchor(pattern)
        if not cleaned:
            return False
        return bool(re.search(cleaned, build_canonical_description(record), re.IGNORECASE))
    except re.error:
        return False


def apply_to_accounts_allowlist(rule: dict) -> list[str] | None:
    """Return account allow-list if the rule restricts by account, else None.

    Both `null` and `[]` mean unrestricted (no account check).
    """
    apply_to_accounts = rule.get('apply_to_accounts', None)
    if apply_to_accounts is None:
        return None
    if not isinstance(apply_to_accounts, list):
        return None
    cleaned = [str(value) for value in apply_to_accounts if str(value)]
    return cleaned or None


def rule_matches_record(rule: dict, record: dict) -> bool:
    """True when the rule regex matches and apply_to_accounts (if set) includes the account."""
    if not regex_matches_record(rule.get('regex', ''), record):
        return False
    allowed = apply_to_accounts_allowlist(rule)
    if allowed is None:
        return True
    account = str(record.get('account') or '')
    return account in allowed


def _collect_rules_from_payload(raw) -> list:
    if isinstance(raw, list):
        return [rule for rule in raw if isinstance(rule, dict)]
    if not isinstance(raw, dict):
        return []
    collected = []
    for key, bucket in raw.items():
        if isinstance(bucket, list):
            collected.extend(rule for rule in bucket if isinstance(rule, dict))
        elif isinstance(bucket, dict):
            # Support accidental major -> minor -> [rules] nesting.
            for sub_bucket in bucket.values():
                if isinstance(sub_bucket, list):
                    collected.extend(rule for rule in sub_bucket if isinstance(rule, dict))
    return collected


def _normalize_rules_payload(raw) -> dict:
    grouped: dict[str, list] = {}
    for rule in _collect_rules_from_payload(raw):
        key = category_key_for_rule(rule)
        grouped.setdefault(key, []).append(rule)
    return grouped


def load_rules_data(strict: bool = False):
    path = get_rules_path()
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            raw = json.load(handle)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        if strict:
            raise
        return {}
    return _normalize_rules_payload(raw or {})


def flatten_rules(rules_data):
    if isinstance(rules_data, list):
        return rules_data
    if isinstance(rules_data, dict):
        flattened: list[dict] = []
        for bucket in rules_data.values():
            if isinstance(bucket, list):
                flattened.extend(bucket)
        return flattened
    return []


def append_rule(rule: dict, *, persist: bool = True) -> dict:
    """Reload rules.json from disk, append rule if its id is new, optionally write back.

    Disk is treated as the source of truth so concurrent manual edits are preserved.
    Rules are stored under major:minor category keys.
    Raises json.JSONDecodeError if rules.json exists but is currently invalid.
    """
    rules_data = load_rules_data(strict=True)
    rule_id = rule.get('id')
    if rule_id and any(existing.get('id') == rule_id for existing in flatten_rules(rules_data)):
        return rules_data
    key = category_key_for_rule(rule)
    sanitized = {
        **rule,
        'regex': strip_trailing_end_anchor(str(rule.get('regex', ''))),
    }
    if not str(sanitized.get('category', '')).strip():
        sanitized['category'] = key
    if 'apply_to_accounts' not in sanitized:
        sanitized['apply_to_accounts'] = None
    rules_data.setdefault(key, []).append(sanitized)
    if persist:
        write_json_file(get_rules_path(), rules_data)
    return rules_data


def sort_rules_by_specificity(rules):
    return sorted(rules, key=lambda r: len(r.get('regex', '') or ''), reverse=True)


def get_rules_path():
    return str(Path(resolve_repo_root()) / 'tools' / 'rules.json')
