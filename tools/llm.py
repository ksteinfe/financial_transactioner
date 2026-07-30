#!/usr/bin/env python3
import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from utils import parse_dotenv, regex_matches_record, resolve_repo_root, strip_trailing_end_anchor


def get_llm_debug_log_path() -> Path:
    return Path(resolve_repo_root()) / 'tools' / 'llm_debug.log'


def append_llm_debug_log(message: str):
    try:
        with open(get_llm_debug_log_path(), 'a', encoding='utf-8') as handle:
            handle.write(f"{datetime.now(timezone.utc).isoformat()} {message}\n")
    except Exception:
        pass


def is_valid_regex(pattern: str) -> bool:
    try:
        re.compile(pattern)
        return True
    except re.error:
        return False


def regex_option_pattern(option) -> str:
    if isinstance(option, dict):
        pattern = str(option.get('regex') or option.get('pattern') or '').strip()
    else:
        pattern = str(option or '').strip()
    return strip_trailing_end_anchor(pattern)


def regex_option_summary(option) -> str:
    if isinstance(option, dict):
        return str(option.get('summary') or option.get('description') or '').strip()
    return ''


def format_regex_option(option) -> str:
    pattern = regex_option_pattern(option)
    summary = regex_option_summary(option)
    if summary and pattern:
        return f"{pattern}   ({summary})"
    return summary or pattern


def regex_options_are_valid(regex_options: list) -> bool:
    if not regex_options:
        return False
    return all(is_valid_regex(regex_option_pattern(option)) for option in regex_options)


def request_suggestion(prompt: str, api_key: str, require_categories: bool = True):
    max_invalid_retries = 2
    last_response = None
    log_path = get_llm_debug_log_path()

    for attempt in range(max_invalid_retries + 1):
        max_tokens = 800 + (attempt * 400)
        try:
            response = call_openai(prompt, api_key, max_tokens=max_tokens)
        except Exception as exc:
            message = f"LLM request failed: {exc}"
            if attempt < max_invalid_retries:
                message = f"{message}; retrying ({attempt + 1}/{max_invalid_retries})."
                print(f"{message} See {log_path} for details.")
                append_llm_debug_log(message)
                append_llm_debug_log(f"Prompt: {prompt}")
                continue
            print(f"{message} See {log_path} for details.")
            append_llm_debug_log(message)
            append_llm_debug_log(f"Prompt: {prompt}")
            return None

        last_response = response
        finish_reason = response.get('choices', [{}])[0].get('finish_reason')
        parsed = parse_openai_response(response)
        if parsed is None:
            truncated = finish_reason == 'length'
            reason = 'truncated response (hit max_tokens)' if truncated else 'invalid/unparseable response'
            if attempt < max_invalid_retries:
                message = f"LLM returned {reason}; retrying ({attempt + 1}/{max_invalid_retries})."
                print(f"{message} See {log_path} for details.")
                append_llm_debug_log(message)
                append_llm_debug_log(f"Prompt: {prompt}")
                append_llm_debug_log(f"Raw response: {json.dumps(response, ensure_ascii=False)}")
                continue
            message = 'LLM returned an invalid response; continuing without LLM suggestion.'
            print(f"{message} See {log_path} for details.")
            append_llm_debug_log(message)
            append_llm_debug_log(f"Prompt: {prompt}")
            append_llm_debug_log(f"Raw response: {json.dumps(response, ensure_ascii=False)}")
            return None

        normalized = normalize_suggestion(parsed, require_categories=require_categories)
        if normalized is None:
            if attempt < max_invalid_retries:
                message = (
                    'LLM returned a parseable JSON payload, but categories/regex_options were missing or invalid; '
                    f'retrying ({attempt + 1}/{max_invalid_retries}).'
                )
                print(f"{message} See {log_path} for details.")
                append_llm_debug_log(message)
                append_llm_debug_log(f"Parsed JSON: {json.dumps(parsed, ensure_ascii=False)}")
                continue
            message = 'LLM returned a parseable JSON payload, but categories/regex_options were missing or invalid.'
            print(f"{message} See {log_path} for details.")
            append_llm_debug_log(message)
            append_llm_debug_log(f"Parsed JSON: {json.dumps(parsed, ensure_ascii=False)}")
            return None
        return normalized

    if last_response is not None:
        append_llm_debug_log(f"Exhausted retries. Last raw response: {json.dumps(last_response, ensure_ascii=False)}")
    return None


def validate_or_retry_regex_options(
    prompt: str,
    api_key: str,
    normalized: dict | None,
    require_categories: bool = True,
):
    if normalized is None or regex_options_are_valid(normalized['regex_options']):
        return normalized
    invalid = [
        regex_option_pattern(option)
        for option in normalized['regex_options']
        if not is_valid_regex(regex_option_pattern(option))
    ]
    message = (
        'LLM returned one or more invalid regex suggestions; retrying once. '
        f'Invalid patterns: {json.dumps(invalid, ensure_ascii=False)}'
    )
    log_path = get_llm_debug_log_path()
    print(f"{message} See {log_path} for details.")
    append_llm_debug_log(message)
    append_llm_debug_log(f"Suggestion: {json.dumps(normalized, ensure_ascii=False)}")
    retried = request_suggestion(prompt, api_key, require_categories=require_categories)
    if retried is not None and not regex_options_are_valid(retried['regex_options']):
        message = 'LLM retry still returned invalid regex suggestions; continuing without LLM suggestion.'
        print(f"{message} See {log_path} for details.")
        append_llm_debug_log(message)
        append_llm_debug_log(f"Retry suggestion: {json.dumps(retried, ensure_ascii=False)}")
        return None
    return retried


def get_openai_credentials():
    openai_key = os.environ.get('OPENAI_API_KEY') or load_env_value('OPENAI_API_KEY')
    provider = os.environ.get('LLM_PROVIDER', 'openai')
    if provider != 'openai' or not openai_key:
        return None
    return openai_key


def filter_regex_options_for_record(record: dict, regex_options: list | None) -> list:
    """Keep only regex options that match this transaction; note rejects in CLI."""
    if not regex_options:
        return []
    kept = []
    rejected = []
    for option in regex_options:
        pattern = regex_option_pattern(option)
        if pattern and regex_matches_record(pattern, record):
            kept.append(option)
        else:
            rejected.append(option)
    if rejected:
        print(
            f"Rejected {len(rejected)} LLM regex suggestion(s) that do not match this transaction "
            f"(not shown as options):"
        )
        for option in rejected:
            print(f"  - {format_regex_option(option) or regex_option_pattern(option) or '<empty>'}")
    return kept


def suggest_category_and_rule(record: dict):
    openai_key = get_openai_credentials()
    if not openai_key:
        return None
    prompt = build_prompt(record)
    normalized = request_suggestion(prompt, openai_key)
    validated = validate_or_retry_regex_options(prompt, openai_key, normalized)
    if validated is None:
        return None
    validated = {
        **validated,
        'regex_options': filter_regex_options_for_record(record, validated.get('regex_options')),
    }
    return validated


def suggest_regex_options(record: dict, previous_options: list | None = None):
    openai_key = get_openai_credentials()
    if not openai_key:
        return None
    previous_patterns = [regex_option_pattern(option) for option in (previous_options or [])]
    previous_patterns = [pattern for pattern in previous_patterns if pattern]
    prompt = build_regex_refresh_prompt(record, previous_patterns)
    normalized = request_suggestion(prompt, openai_key, require_categories=False)
    validated = validate_or_retry_regex_options(
        prompt, openai_key, normalized, require_categories=False
    )
    if validated is None:
        return None
    kept = filter_regex_options_for_record(record, validated.get('regex_options'))
    return kept or None


def normalize_regex_option(option):
    if isinstance(option, dict):
        pattern = regex_option_pattern(option)
        if not pattern:
            return None
        summary = regex_option_summary(option)
        return {'regex': pattern, 'summary': summary}
    pattern = regex_option_pattern(option)
    if not pattern:
        return None
    return {'regex': pattern, 'summary': ''}


def normalize_suggestion(response: dict | None, require_categories: bool = True):
    if not isinstance(response, dict):
        return None
    categories = response.get('categories')
    regex_options = response.get('regex_options')
    if categories is None and response.get('category'):
        categories = [response.get('category')]
    if regex_options is None and response.get('regex'):
        regex_options = [response.get('regex')]
    if isinstance(categories, str):
        categories = [categories]
    if isinstance(regex_options, str):
        regex_options = [regex_options]
    cleaned_regex = []
    for option in regex_options or []:
        normalized_option = normalize_regex_option(option)
        if normalized_option is not None:
            cleaned_regex.append(normalized_option)
    if not cleaned_regex:
        return None
    cleaned_categories = [str(c).strip() for c in (categories or []) if str(c).strip()]
    if require_categories:
        allowed = set(load_allowed_categories())
        cleaned_categories = [
            category for category in cleaned_categories if category in allowed
        ]
        if not cleaned_categories:
            return None
    return {
        'categories': cleaned_categories,
        'regex_options': cleaned_regex,
    }


def load_env_value(key: str):
    env_file = Path(resolve_repo_root()) / '.env'
    try:
        text = env_file.read_text(encoding='utf-8')
    except FileNotFoundError:
        return None
    return parse_dotenv(text).get(key)


def load_allowed_categories():
    categories_path = Path(resolve_repo_root()) / 'reference' / 'allowed-categories.json'
    try:
        with open(categories_path, 'r', encoding='utf-8') as handle:
            return json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def regex_guidance() -> str:
    return (
        'Provide 5 regex options ordered most specific to most general. '
        'Each regex_options entry must be an object with keys regex and summary. '
        'summary must be a very short plain-English description of what the pattern matches '
        '(about 3-12 words), similar to: "exact match only", '
        '"vendor name plus one trailing token", "vendor name plus trailing digits", '
        '"starts with vendor name", or "HORTICULTURAL anywhere in string". '
        'The first regex should be very specific and match nearly the entire description string. '
        'Middle options should keep the vendor/payee name and the basic structural shape of the description '
        '(labels, separators, keywords like DES:, ID:, Confirmation#, PPD, etc.), while replacing volatile tokens '
        'such as confirmation IDs, reference numbers, check numbers, account names/numbers, customer IDs, '
        'and similar one-off identifiers with wildcards like \\d+, [A-Z0-9]+, or .*. '
        'Do not hard-code ephemeral identifiers that will differ on the next transaction from the same vendor. '
        'The last regex should be the most general appropriate vendor/structure pattern. '
        'For example, if the description is "Online scheduled transfer to CHK 2232 Confirmation# XXXXX17718", '
        'good regex options could include '
        '{"regex":"^Online scheduled transfer to CHK 2232 Confirmation# .*","summary":"specific transfer with confirmation"}, '
        '{"regex":"^Online scheduled transfer to CHK 2232 Confirmation#\\\\s+\\\\S+","summary":"transfer plus confirmation token"}, '
        '{"regex":"^Online scheduled transfer to CHK \\\\d+ Confirmation#.*","summary":"any CHK account with confirmation"}, '
        '{"regex":"^Online scheduled transfer to CHK \\\\d+.*","summary":"scheduled transfer to any CHK"}, '
        'and {"regex":"^Online scheduled transfer.*","summary":"any online scheduled transfer"}. '
        'Avoid overly broad catch-all patterns like ".*" when they are not the most appropriate option. '
        'Never end a regex with a trailing "$" end anchor; matching is applied to a longer canonical string that may include source metadata after the description. '
        'Keep regex patterns compact, especially for long descriptions; prefer wildcards over copying the entire string. '
        'Escape every backslash in regex strings as "\\\\" so the JSON remains valid. '
        'Return complete, valid JSON only: close every string, array, and object. '
        'Do not include extra text outside the JSON.'
    )


def build_prompt(record: dict) -> str:
    rounded_amount = '' if record.get('amount') is None else str(round(record['amount']))
    description = record.get('description') or ''
    bank_category = record.get('bank_category') or ''
    allowed_categories = load_allowed_categories()
    return (
        'You are a transaction categorization assistant. A new transaction arrives with the following fields. '
        'Dates are removed for privacy. Amounts are approximated. Return only valid JSON with keys categories and regex_options.\n'
        '{\n'
        f'  "description": {json.dumps(description)},\n'
        f'  "amount": {json.dumps(rounded_amount)},\n'
        f'  "bank_category": {json.dumps(bank_category)},\n'
        f'  "allowed_categories": {json.dumps(allowed_categories)}\n'
        '}\n'
        'Respond with JSON exactly in this form:\n'
        '{"categories":["major:minor", "major:minor", "major:minor", "major:minor", "major:minor"], '
        '"regex_options":[{"regex":"...","summary":"..."}, {"regex":"...","summary":"..."}, '
        '{"regex":"...","summary":"..."}, {"regex":"...","summary":"..."}, {"regex":"...","summary":"..."}]}\n'
        'Provide 5 category suggestions ordered most likely to least likely. '
        f'{regex_guidance()}'
    )


def build_regex_refresh_prompt(record: dict, previous_options: list[str]) -> str:
    rounded_amount = '' if record.get('amount') is None else str(round(record['amount']))
    description = record.get('description') or ''
    bank_category = record.get('bank_category') or ''
    return (
        'You previously suggested regex patterns for categorizing this transaction, but the user wants different options. '
        'Return only valid JSON with the key regex_options.\n'
        '{\n'
        f'  "description": {json.dumps(description)},\n'
        f'  "amount": {json.dumps(rounded_amount)},\n'
        f'  "bank_category": {json.dumps(bank_category)},\n'
        f'  "previous_regex_options": {json.dumps(previous_options)}\n'
        '}\n'
        'Respond with JSON exactly in this form:\n'
        '{"regex_options":[{"regex":"...","summary":"..."}, {"regex":"...","summary":"..."}, '
        '{"regex":"...","summary":"..."}, {"regex":"...","summary":"..."}, {"regex":"...","summary":"..."}]}\n'
        'Do not repeat the previous_regex_options. Offer meaningfully different alternatives. '
        f'{regex_guidance()}'
    )


def call_openai(prompt: str, api_key: str, max_tokens: int = 800):
    url = 'https://api.openai.com/v1/chat/completions'
    body = json.dumps({
        'model': 'gpt-4o-mini',
        'messages': [
            {'role': 'system', 'content': 'You are a helpful transaction categorization assistant.'},
            {'role': 'user', 'content': prompt},
        ],
        'max_tokens': max_tokens,
        'temperature': 0.2,
    }).encode('utf-8')
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
        },
        method='POST',
    )
    with urllib.request.urlopen(request) as response:
        response_text = response.read().decode('utf-8')
    return json.loads(response_text)


def escape_invalid_json_backslashes(text: str) -> str:
    valid_json_escapes = {'"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'}
    result = []
    in_string = False
    escaped = False
    for char in text:
        if escaped:
            if in_string and char not in valid_json_escapes:
                result.append('\\')
            result.append(char)
            escaped = False
        elif char == '\\':
            escaped = True
            result.append(char)
        else:
            if char == '"':
                in_string = not in_string
            result.append(char)
    if escaped:
        result.append('\\')
    return ''.join(result)


def repair_json_text(text: str) -> str:
    """Fix common LLM JSON mistakes: invalid \\ escapes, missing ]/}, truncated strings."""
    text = escape_invalid_json_backslashes(text.strip())
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    first = text.find('{')
    if first == -1:
        return text
    text = text[first:]

    out = []
    in_string = False
    escaped = False
    stack = []
    for char in text:
        if escaped:
            out.append(char)
            escaped = False
            continue
        if char == '\\' and in_string:
            out.append(char)
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            out.append(char)
            continue
        if in_string:
            out.append(char)
            continue
        if char in '{[':
            stack.append('}' if char == '{' else ']')
            out.append(char)
        elif char in '}]':
            while stack and stack[-1] != char:
                out.append(stack.pop())
            if stack and stack[-1] == char:
                stack.pop()
                out.append(char)
        else:
            out.append(char)

    if in_string:
        out.append('"')
    while stack:
        out.append(stack.pop())
    return ''.join(out)


def parse_openai_response(payload: dict):
    content = payload.get('choices', [{}])[0].get('message', {}).get('content')
    if not isinstance(content, str):
        return None
    trimmed = content.strip()
    try:
        return json.loads(trimmed)
    except json.JSONDecodeError:
        repaired = repair_json_text(trimmed)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            return None
    return None
