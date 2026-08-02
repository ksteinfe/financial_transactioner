# tools/

Workspace for transaction ingestion and transformation tooling. **Apps** (Electron and shared TypeScript packages) live under **`../apps/`** — see [apps/README.md](../apps/README.md).

Deeper behavioral notes for agents/engineers: [AGENT_GUIDE.md](AGENT_GUIDE.md). Corpus schema: [`docs/corpus-format.md`](../docs/corpus-format.md).

## Setup

1. Copy `.env.example` to `.env` at the repo root (if needed).
2. Set `TRANSACTION_CORPUS_DIR` to the corpus directory on disk.
3. Optionally set `OPENAI_API_KEY` when using LLM-assisted categorization during integrate.

Tools are run from the repo root as `python tools/<script>.py ...`.

## Tool catalog

### CLI tools

| Script | Purpose |
| --- | --- |
| [`ingest.py`](#ingestpy) | Parse bank CSV exports into immutable JSONL |
| [`integrate_with_corpus.py`](#integrate_with_corpuspy) | Categorize ingested records and write them into the corpus |
| [`rebuild_corpus_summary.py`](#rebuild_corpus_summarypy) | Recompute `corpus-summary.json` from current year files |
| [`rules.py`](#rulespy) | List / add / preview categorization rules |
| [`compare_corpus_categories.py`](#compare_corpus_categoriespy) | Diff corpus categories vs `reference/allowed-categories.json` |

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
| `llm_debug.log` | Local LLM debug log (generated; not source of truth) |

`_tmp_check_ingest.py` is an ad-hoc scratch script and is not part of the supported tool set.

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

Output: `import_<timestamp>_ingested.jsonl` in the input folder. Account resolution uses `reference/allowed-accounts.json` (filename match, or interactive prompt unless `--account` is set).

---

### `integrate_with_corpus.py`

Apply rules (and interactive / LLM prompts) to ingested records, then append them into year files under `TRANSACTION_CORPUS_DIR`. After a confirmed write, rebuilds `corpus-summary.json` automatically.

```bash
python tools/integrate_with_corpus.py --input <download-subfolder|ingested-file> [--dry-run] [--persist-rules]
```

| Flag | Description |
| --- | --- |
| `--input` | Ingest folder (finds latest `*_ingested.jsonl`) or a specific JSONL file |
| `--dry-run` | Do not write corpus year files |
| `--persist-rules` | With `--dry-run`, still persist newly created rules |

Progress is saved to `<ingested_stem>.progress.json` next to the JSONL so runs can pause (`q` / Ctrl+C) and resume. The progress file is removed only after a successful non-dry-run corpus write.

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

### `rules.py`

Manage regex auto-categorization rules stored in `tools/rules.json`.

```bash
python tools/rules.py list
python tools/rules.py add --regex '<pattern>' --category '<major:minor>' [--notes '...']
python tools/rules.py preview --sample 'sample text'
```

| Subcommand | Description |
| --- | --- |
| `list` | Print rules grouped by category |
| `add` | Append a new rule (`--regex`, `--category` required; `--notes` optional) |
| `preview` | Show which rules match `--sample` text |

---

### `compare_corpus_categories.py`

Read-only audit: compare categories present in corpus `YYYY.json` files against `reference/allowed-categories.json`. Reports categories only in the corpus, only in the allowlist, and shared counts.

```bash
python tools/compare_corpus_categories.py
python tools/compare_corpus_categories.py <corpus-dir>
```

If `<corpus-dir>` is omitted, uses a hardcoded default path in the script (override by passing an argument). Does not modify the corpus or summary.

---

### `corpus_summary.py`

Library module — **canonical Python entry point** for updating `corpus-summary.json`. Any tool that changes yearly transaction data MUST call this after a successful write.

Primary API:

- `rebuild_corpus_summary(corpus_dir)` — recompute and atomically write the summary
- `compute_corpus_summary(corpus_dir)` — build the document without writing
- `iter_year_json_files(corpus_dir)` — list `YYYY.json` paths (excludes the summary)

Apps use the TypeScript equivalent in `@txn/corpus-core`; keep aggregation rules aligned.

---

### `utils.py`

Shared helpers used across CLIs:

- `.env` loading and repo-root resolution
- CSV parsing / amount & date normalization
- Allowed-account resolution from filenames
- Rules load/flatten/append and regex matching
- JSON read/write helpers

Not a CLI.

---

### `llm.py`

OpenAI API helpers used by `integrate_with_corpus.py` for category and regex suggestions. Reads `OPENAI_API_KEY` from the environment / `.env`. Writes optional debug lines to `tools/llm_debug.log`. Not a standalone CLI.

---

## Typical workflow

1. **Ingest** exports → `python tools/ingest.py --input <folder>`
2. **Dry-run integrate** (optional) → `python tools/integrate_with_corpus.py --input <folder> --dry-run`
3. **Integrate for real** → `python tools/integrate_with_corpus.py --input <folder>`  
   (rebuilds `corpus-summary.json` after write)
4. **Refresh summary only** (if needed) → `python tools/rebuild_corpus_summary.py`
5. **Audit categories** (optional) → `python tools/compare_corpus_categories.py <corpus-dir>`
6. **Manage rules** → `python tools/rules.py list|add|preview`

### Pause / resume integration

- Each decided categorization is saved immediately to `<ingested_stem>.progress.json`.
- Stop with `q` at a prompt, or Ctrl+C; progress is kept.
- Resume with the same `--input`; saved categorizations are reapplied.
- Progress file is deleted only after a successful (non-dry-run) corpus write.

### Corpus summary (required after writes)

`corpus-summary.json` is a derived index at the corpus root (year / month / category rollups). It is not a year file.

- Library: `from corpus_summary import rebuild_corpus_summary`
- CLI: `python tools/rebuild_corpus_summary.py [--corpus-dir <path>]`
- `integrate_with_corpus.py` rebuilds automatically after a confirmed write

## Rules storage

- `tools/rules.json` is git-tracked and stores regex rules nested by `major:minor`.
- Sample CSVs may live in `tools/sample_data/test/`.

## Privacy

- Ingested records are written only into your external download folder and are not kept in git.
- The corpus lives outside the repo at `TRANSACTION_CORPUS_DIR`.
- Repo-managed rule state is `tools/rules.json`.
