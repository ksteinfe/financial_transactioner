# tools/

Workspace for transaction ingestion and transformation tooling. **Apps** (Electron and shared TypeScript packages) live under **`../apps/`** — see [apps/README.md](../apps/README.md).

Deeper behavioral notes for agents/engineers: [AGENT_GUIDE.md](AGENT_GUIDE.md). Corpus schema: [`docs/corpus-format.md`](../docs/corpus-format.md).

## Setup

1. Copy `.env.example` to `.env` at the repo root (if needed).
2. Set `TRANSACTION_CORPUS_DIR` to the corpus directory on disk.
3. Optionally set `OPENAI_API_KEY` when using LLM-assisted categorization during integrate.

Run tools from the **repo root**:

```bash
python tools/<script>.py ...
```

## Tool catalog

### CLI tools

| Script | Purpose |
| --- | --- |
| [`ingest.py`](#ingestpy) | Parse bank CSV exports into immutable JSONL |
| [`translate_legacy_csv.py`](#translate_legacy_csvpy) | Convert a legacy categorized CSV into current ingest JSONL |
| [`integrate_with_corpus.py`](#integrate_with_corpuspy) | Categorize ingested records and write them into the corpus |
| [`reconcile_year_dates.py`](#reconcile_year_datespy) | Backfill `date_original` by comparing a corpus year to ingest JSONL |
| [`rebuild_corpus_summary.py`](#rebuild_corpus_summarypy) | Recompute `corpus-summary.json` from current year files |
| [`avg_monthly_spending.py`](#avg_monthly_spendingpy) | Average monthly spending per major category over a month range |
| [`rules.py`](#rulespy) | List / add / preview categorization rules |
| [`compare_corpus_categories.py`](#compare_corpus_categoriespy) | Diff corpus categories vs `reference/allowed-categories.json` |
| [`strip_legacy_source_key.py`](#strip_legacy_source_keypy) | One-shot cleanup: remove undocumented `source_key` from year files |

### Libraries (imported by CLIs; not usually run directly)

| Module | Purpose |
| --- | --- |
| [`corpus_summary.py`](#corpus_summarypy) | Canonical Python rebuild of `corpus-summary.json` |
| [`utils.py`](#utilspy) | Shared helpers (env, CSV, rules I/O, accounts, regex matching) |
| [`llm.py`](#llmpy) | OpenAI helpers for category/regex suggestions during integrate |

### Supporting files

| Path | Purpose |
| --- | --- |
| `rules.json` | Git-tracked regex categorization rules, nested by `major:minor` |
| `package.json` | Optional npm script aliases (`ingest`, `integrate`, `rules`) |
| `AGENT_GUIDE.md` | Implementation guide for agents working in `tools/` |
| `sample_data/test/` | Sample CSVs / ingest fixtures for local testing |
| `llm_debug.log` | Local LLM debug log (generated at runtime; not source of truth) |

`_tmp_check_ingest.py` is an ad-hoc scratch script and is **not** part of the supported tool set.

---

## CLI reference (cheat sheet)

```bash
# Bank export → JSONL
python tools/ingest.py --input <download-subfolder> [--force] [--account <account>]

# Legacy categorized CSV → JSONL
python tools/translate_legacy_csv.py --input <file.csv> [--output <out.jsonl>] [--force]

# JSONL → corpus (interactive / rules / LLM)
python tools/integrate_with_corpus.py --input <folder|file> [--dry-run] [--persist-rules]

# Backfill date_original from ingest JSONL tree
python tools/reconcile_year_dates.py --year YYYY --ingest-root <downloads-root> [--dry-run] [--corpus-dir <path>]

# Rebuild derived summary only
python tools/rebuild_corpus_summary.py [--corpus-dir <path>]

# Average monthly spending by major over a month range
python tools/avg_monthly_spending.py --from YYYY-MM --to YYYY-MM [--corpus-dir <path>] [--json]

# Rules
python tools/rules.py list
python tools/rules.py add --regex '<pattern>' --category '<major:minor>' [--notes '...']
python tools/rules.py preview --sample 'sample text'

# Audits / one-shot cleanup
python tools/compare_corpus_categories.py [<corpus-dir>]
python tools/strip_legacy_source_key.py [<corpus-dir>]
```

---

### `ingest.py`

Ingest bank/card CSV exports into normalized, immutable JSONL records (one JSON object per line). Does **not** write to the corpus.

```bash
python tools/ingest.py --input <download-subfolder> [--force] [--account <allowlisted-account>]
```

| Flag | Description |
| --- | --- |
| `--input` | Directory containing exported CSV files (required) |
| `--force` | Overwrite an existing `import_*_ingested.jsonl` in that folder |
| `--account` | Force one allowlisted account for every source file in the run |

**Output:** `import_<timestamp>_ingested.jsonl` in the input folder.

Each record includes `key`, `source_file`, `source_row_number`, `date`, `amount`, `account`, `description`, `bank_category`, and `raw` (original CSV row). Account resolution uses `reference/allowed-accounts.json` (filename match, or interactive prompt unless `--account` is set).

---

### `translate_legacy_csv.py`

Convert a **legacy pre-categorized CSV** (older ingest format) into the current `*_ingested.jsonl` shape used by `integrate_with_corpus.py`.

Expected CSV header:

```text
date,amount,account,description,category,bank_category,rule_used,notes,transaction_key
```

```bash
python tools/translate_legacy_csv.py --input path/to/file.csv
python tools/translate_legacy_csv.py --input path/to/file.csv --output path/to/out.jsonl --force
```

| Flag | Description |
| --- | --- |
| `--input` | Path to a legacy `.csv` file (required) |
| `--output` | JSONL path (default: `<csv_stem>_ingested.jsonl` next to the CSV) |
| `--force` | Overwrite an existing JSONL file |

**Mapping:**

| Legacy column | JSONL field |
| --- | --- |
| `transaction_key` | `key` (preserved; new UUID only if blank) |
| `date` | `date` (`YYYY-MM-DD`; accepts `M/D/YYYY`) |
| `amount` / `account` / `description` / `bank_category` | same names as `ingest.py` |
| (entire row) | `raw` |

Does **not** write a progress file (category/notes for these rows already live in the corpus).

Sample input: `tools/sample_data/test/legacy_checks_sample.csv`.

---

### `integrate_with_corpus.py`

Apply rules (and interactive / LLM prompts) to ingested records, then append them into year files under `TRANSACTION_CORPUS_DIR`. After a confirmed write, rebuilds `corpus-summary.json` automatically via `corpus_summary.rebuild_corpus_summary`.

```bash
python tools/integrate_with_corpus.py --input <download-subfolder|ingested-file> [--dry-run] [--persist-rules]
```

| Flag | Description |
| --- | --- |
| `--input` | Ingest folder (uses latest `*_ingested.jsonl`) or a specific JSONL file |
| `--dry-run` | Do not write corpus year files |
| `--persist-rules` | With `--dry-run`, still persist newly created rules |

**Behavior notes:**

- Skips records whose `key` already exists in the corpus.
- Progress is saved to `<ingested_stem>.progress.json` next to the JSONL so runs can pause (`q` / Ctrl+C) and resume.
- The progress file is deleted only after a successful non-dry-run corpus write.
- Requires `TRANSACTION_CORPUS_DIR` in `.env`. LLM suggestions need `OPENAI_API_KEY` (optional; without it, prompts fall back to manual entry).

---

### `reconcile_year_dates.py`

Scan one corpus year (`YYYY.json`) and match each transaction by `key` against all `*_ingested.jsonl` files under an ingest root (recursive). When the corpus `date` differs from the ingest `date`, sets `date_original` to the ingest date (does not overwrite an existing `date_original`). Amount mismatches and missing source rows are errors, pretty-printed at the end.

```bash
python tools/reconcile_year_dates.py --year 2025 --ingest-root <downloads-root>
python tools/reconcile_year_dates.py --year 2025 --ingest-root <downloads-root> --dry-run
python tools/reconcile_year_dates.py --year 2025 --ingest-root <downloads-root> --corpus-dir <path>
```

| Flag | Description |
| --- | --- |
| `--year` | Four-digit year to scan in the corpus (required) |
| `--ingest-root` | Directory tree containing `*_ingested.jsonl` files (required) |
| `--corpus-dir` | Corpus root (default: `TRANSACTION_CORPUS_DIR` from `.env`) |
| `--dry-run` | Report only; do not write the year file or rebuild the summary |

On a real write: updates `YYYY.json`, then rebuilds `corpus-summary.json`. Exit code `1` if any errors were collected; `0` otherwise.

---

### `rebuild_corpus_summary.py`

Standalone refresh of the derived summary index. Use after manual corpus edits, or anytime you want to recompute without integrating new records.

```bash
python tools/rebuild_corpus_summary.py
python tools/rebuild_corpus_summary.py --corpus-dir <path>
```

| Flag | Description |
| --- | --- |
| `--corpus-dir` | Corpus root (default: `TRANSACTION_CORPUS_DIR` from `.env`) |

Calls `corpus_summary.rebuild_corpus_summary`. Contract: [`docs/corpus-format.md`](../docs/corpus-format.md) §9.

---

### `avg_monthly_spending.py`

Probe the corpus for an inclusive month range and report **average monthly spending
per major category**. Spending is the sum of absolute values of negative
`amount`s (outflow). Each major’s total is divided by the number of months in the
range (not only months with activity).

```bash
python tools/avg_monthly_spending.py --from 2024-01 --to 2025-06
python tools/avg_monthly_spending.py --from 2024-1 --to 2024-12 --corpus-dir <path>
python tools/avg_monthly_spending.py --from 2024-01 --to 2024-12 --json
```

| Flag | Description |
| --- | --- |
| `--from` | Start month as `YYYY-MM` (inclusive; required) |
| `--to` | End month as `YYYY-MM` (inclusive; required) |
| `--corpus-dir` | Corpus root (default: `TRANSACTION_CORPUS_DIR` from `.env`) |
| `--json` | Print a JSON report instead of a text table |

Reads `YYYY.json` year files whose years overlap the range. Positive amounts
(income/credits) are ignored for spending totals.

---

### `rules.py`

Manage regex auto-categorization rules stored in `tools/rules.json`.

```bash
python tools/rules.py list
python tools/rules.py add --regex '<pattern>' --category '<major:minor>' [--notes '...']
python tools/rules.py preview --sample 'sample text'
```

| Subcommand | Description |
| --- | --- |
| `list` | Print rules grouped by `major:minor` category |
| `add` | Append a new rule (`--regex`, `--category` required; `--notes` optional) |
| `preview` | Show which rules match `--sample` text |

Rules may also include `apply_to_accounts` (`null` / `[]` = unrestricted, or a list of account ids). Matching uses the regex against a canonical description string built from the ingest record.

---

### `compare_corpus_categories.py`

Read-only audit: compare categories present in corpus `YYYY.json` files against `reference/allowed-categories.json`. Reports categories only in the corpus, only in the allowlist, and shared counts (with transaction counts for corpus-only categories).

```bash
python tools/compare_corpus_categories.py
python tools/compare_corpus_categories.py <corpus-dir>
```

If `<corpus-dir>` is omitted, uses a hardcoded default path in the script. Does not modify the corpus or summary. Year files are discovered as `YYYY.json` only (the summary file is not treated as a year file).

---

### `strip_legacy_source_key.py`

Removes the undocumented legacy `source_key` field from all `YYYY.json` transactions, then rebuilds `corpus-summary.json`. Safe to re-run (no-op when none remain).

```bash
python tools/strip_legacy_source_key.py
python tools/strip_legacy_source_key.py <corpus-dir>
```

Corpus path resolution: optional CLI argument, else `TRANSACTION_CORPUS_DIR` from `.env`, else a hardcoded default in the script. `source_key` is not part of the corpus contract; writers must not emit it.

---

### `corpus_summary.py`

Library module — **canonical Python entry point** for updating `corpus-summary.json`. Any tool that changes yearly transaction data MUST call this after a successful write.

| Function | Description |
| --- | --- |
| `rebuild_corpus_summary(corpus_dir)` | Recompute and atomically write the summary |
| `compute_corpus_summary(corpus_dir)` | Build the document without writing |
| `write_corpus_summary_file(corpus_dir, doc)` | Atomic write of an existing document |
| `iter_year_json_files(corpus_dir)` | List `YYYY.json` paths (excludes the summary) |

Constants: `CORPUS_SUMMARY_FILENAME`, `CORPUS_SUMMARY_SCHEMA_VERSION`.

Apps use the TypeScript equivalent in `@txn/corpus-core`; keep aggregation rules aligned. Contract: [`docs/corpus-format.md`](../docs/corpus-format.md) §9.

---

### `utils.py`

Shared helpers used across CLIs (not a CLI itself):

- `.env` loading (`load_dotenv`) and repo-root resolution
- CSV parsing / amount & date normalization
- Allowed-account resolution from filenames (`reference/allowed-accounts.json`)
- Rules load / flatten / append / regex matching (`tools/rules.json`)
- JSON read/write helpers

---

### `llm.py`

OpenAI API helpers used by `integrate_with_corpus.py` for category and regex suggestions. Not a standalone CLI.

- Reads `OPENAI_API_KEY` from the environment / `.env`
- Loads allowed categories from `reference/allowed-categories.json`
- Writes optional debug lines to `tools/llm_debug.log`

---

## Typical workflow

1. **Ingest** bank exports → `python tools/ingest.py --input <folder>`
2. **Dry-run integrate** (optional) → `python tools/integrate_with_corpus.py --input <folder> --dry-run`
3. **Integrate for real** → `python tools/integrate_with_corpus.py --input <folder>`  
   (rebuilds `corpus-summary.json` after write)
4. **Legacy CSV catch-up** (optional) → `python tools/translate_legacy_csv.py --input <file.csv>`
5. **Backfill `date_original`** (optional) → `python tools/reconcile_year_dates.py --year YYYY --ingest-root <downloads-root>`
6. **Refresh summary only** (if needed) → `python tools/rebuild_corpus_summary.py`
7. **Average monthly spending** (optional) → `python tools/avg_monthly_spending.py --from YYYY-MM --to YYYY-MM`
8. **Audit categories** (optional) → `python tools/compare_corpus_categories.py <corpus-dir>`
9. **Manage rules** → `python tools/rules.py list|add|preview`

### Pause / resume integration

- Each decided categorization is saved immediately to `<ingested_stem>.progress.json`.
- Stop with `q` at a prompt, or Ctrl+C; progress is kept.
- Resume with the same `--input`; saved categorizations are reapplied.
- Progress file is deleted only after a successful (non-dry-run) corpus write.

### Corpus summary (required after writes)

`corpus-summary.json` is a derived index at the corpus root (year / month / category rollups). It is not a year file.

- Library: `from corpus_summary import rebuild_corpus_summary`
- CLI: `python tools/rebuild_corpus_summary.py [--corpus-dir <path>]`
- Mutating tools that already rebuild after writes: `integrate_with_corpus.py`, `reconcile_year_dates.py`, `strip_legacy_source_key.py`

## Rules storage

- `tools/rules.json` is git-tracked and stores regex rules nested by `major:minor`.
- Sample CSVs / fixtures may live in `tools/sample_data/test/`.

## Privacy

- Ingested records are written only into your external download folder and are not kept in git.
- The corpus lives outside the repo at `TRANSACTION_CORPUS_DIR`.
- Repo-managed rule state is `tools/rules.json`.
