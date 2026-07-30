# Transaction Tooling Agent Guide

This document describes the current transaction ingestion and integration tooling in `tools/`.
It is written for a future coding agent or engineer who needs to understand how the CLI works, how rules are stored, and what behaviors have been implemented.

## Overview

The `tools/` workspace contains Python command-line tooling for ingesting exported transactions, suggesting categories, creating categorization rules, and integrating transactions into a year-based JSON corpus.

Key scripts:

- `tools/ingest.py`: ingest exporter output into normalized JSONL transaction records
- `tools/rules.py`: manage categorization rules
- `tools/integrate_with_corpus.py`: integrate ingested records into the corpus
- `tools/llm.py`: query an LLM for category and regex suggestions
- `tools/utils.py`: shared helpers for file I/O, rule loading, and parsing

## Storage and Data Format

### Rule storage

Rules are stored in `tools/rules.json` nested by full `major:minor` category.
This keeps related rules together and makes the file easier to scan than a flat list.

Example structure:

```json
{
  "transfer:2232_bills": [
    {
      "id": "rule_1785165784",
      "regex": "Online scheduled transfer to CHK 2232 Confirmation#.*",
      "category": "transfer:2232_bills",
      "created_at": "2026-07-27T15:23:04.995365+00:00",
      "created_by": "llm",
      "notes": "all xfers TO 2232_bills"
    }
  ],
  "income:misc": [
    {
      "id": "rule_1785165854",
      "regex": "Interest Earned.*",
      "category": "income:misc",
      "created_at": "2026-07-27T15:24:14.578944+00:00",
      "created_by": "llm",
      "notes": "earned interest"
    }
  ]
}
```

Each rule contains at least:

- `id`
- `regex`
- `category`
- `created_at`
- `created_by`
- `notes`
- `apply_to_accounts` (`null`, `[]`, or a list of account names that must match)

When `apply_to_accounts` is `null` or `[]`, matching uses only the regex against the canonical description.
When it is a non-empty list, the transaction `account` must also be one of those values.

The nesting key is the rule's full `category` value (`major:minor`).
`load_rules_data()` also migrates legacy formats (flat list, or nested by major only) into this shape on read.

### Corpus storage

Transaction integration writes to year-based files under the corpus root configured by `TRANSACTION_CORPUS_DIR` in the repository `.env`.
Each year file is JSON and contains a `transactions` array plus metadata such as `last_sync_date`, `sources`, and `last_push_date`.

## Rule loading and usage

Shared helpers in `tools/utils.py` manage rule loading and flattening:

- `load_rules_data()`: reads `tools/rules.json` and returns nested buckets keyed by `major:minor`. It migrates legacy flat-list and major-only nesting into this form.
- `flatten_rules()`: produces a flat list of rules for matching and previewing.
- `sort_rules_by_specificity()`: sorts rules by regex length, longest first.
- `append_rule()`: reloads from disk, appends under the rule's `major:minor` key, and writes back.

## `tools/rules.py`

This CLI manages rule creation, listing, and previewing:

- `python tools/rules.py list`
  - prints rules grouped by `major:minor` category
- `python tools/rules.py add --regex '<pattern>' --category '<major:minor>' [--notes '<text>']`
  - creates a new rule under the `major:minor` bucket in `tools/rules.json`
- `python tools/rules.py preview --sample 'sample text'`
  - searches all rules and prints matching rules

## `tools/integrate_with_corpus.py`

This CLI integrates ingested transaction records into the target corpus.

### New flow and behaviors

- Loads ingested records from an input file or folder containing `_ingested.jsonl`.
- Loads rules from `tools/rules.json` as nested `major:minor` buckets, then flattens them for matching.
- Applies existing rules if a match is found.
- If multiple matching rules exist, prompts the user to choose one.
- If no rule applies, it consults `tools/llm.py` for suggestions.
- Category selection and regex suggestion are presented separately:
  1. show category options only
  2. after category selection, show regex options only
- If the user skips category selection, the transaction is assigned `unknown:undefined` and can still be integrated.
- Rule creation during integration persists new rules only when allowed by dry-run semantics.

### Dry-run semantics

- `--dry-run`
  - full dry run: no corpus writes, no rule persistence
- `--dry-run --persist-rules`
  - partial dry run: rule persistence allowed, corpus writes skipped
- confirmation is requested before batch writing the integrated transaction payload into year files.

### Batch integration

Transactions are not written one-by-one.
They are collected into pending year files, then written in a batch after user confirmation.
This reduces partial-write risk and gives the user a single commit decision for the entire batch.

## `tools/llm.py`

This module requests category and regex suggestions from an LLM.

### Current behavior

- Loads allowed categories from `reference/allowed-categories.json` and includes them in the prompt.
- Prompts the LLM to return valid JSON only, with:
  - 5 category suggestions, ordered most likely to least likely
  - 5 regex suggestions, ordered from very specific to very general
- The prompt specifically asks for:
  - a very specific regex that matches nearly the whole description
  - progressively broader regexes
- This helps the integration CLI present high-confidence options plus fallback patterns.

### Response handling

- Parses the OpenAI response and normalizes escaped regex backslashes so JSON remains valid.
- If parsing fails or the response is invalid, the tool logs the prompt and raw response to `tools/llm_debug.log` and skips LLM suggestion.

## Deferred categorization

When the user defers category selection during integration, the tool now uses `unknown:undefined` as the fallback category.
This allows the transaction to enter the corpus while preserving the ability to revisit the decision later.

## Notes for future agents

- If extending the tool, preserve the separation between rule persistence and corpus writes.
- Keep `rules.json` nested by `major:minor` category whenever new rules are written.
- Avoid introducing `name` fields on rules; the current representation is intentionally minimal.
- Maintain the LLM prompt structure that requests discrete categories first and regex options second.

## Suggested future improvements

- add a dedicated review process for `unknown:undefined` transactions
- provide a UI or script to re-categorize pending `unknown:undefined` records
- add tests for the nested `tools/rules.json` format and legacy migration path
