# tools/

Workspace for transaction ingestion and transformation tooling. **Apps** (Electron and shared TypeScript packages) live under **`../apps/`** — see [apps/README.md](../apps/README.md).

Planned scope:

- importers for bank/card exports (CSV, OFX, QFX, etc.)
- normalization to an internal transaction schema
- deterministic rule-based enrichment and reconciliation
- write/update operations against a local JSON corpus
- validation and consistency tooling
- after writes that change transactions, rebuild **`corpus-summary.json`** (see repo `docs/corpus-format.md`) so apps can keep using the summary for fast loads

Initial expectation:

- tools read `TRANSACTION_CORPUS_DIR` from the repository root `.env`.
- input transaction folders are provided directly to the CLIs via `--input <path>`.
- copy `.env.example` to `.env` and set `TRANSACTION_CORPUS_DIR` before running tools.

Step-by-step usage:

1. prepare environment

   - copy `.env.example` to `.env` at the repo root if not already present.
   - set `TRANSACTION_CORPUS_DIR` to the corpus location.
   - optionally set `OPENAI_API_KEY` in `.env` or the shell when using `--auto-llm`.

2. ingest exported transaction files

   - run:
     `python tools/ingest.py --input <download-subfolder>`
   - this writes a file named `import_<timestamp>_ingested.jsonl` in the same folder.
   - if you want to overwrite an existing ingest file, add `--force`.

3. preview integration with a dry run

   - run:
     `python tools/integrate_with_corpus.py --input <download-subfolder|ingested-file> --dry-run`
   - this reads the ingested records, simulates writers, and skips both rule persistence and corpus writes.
   - interactive prompts and auto-LLM suggestions run by default during this preview.
   - use `--dry-run --persist-rules` to simulate corpus writes while persisting any newly created rules.

4. integrate into the corpus for real

   - run:
     `python tools/integrate_with_corpus.py --input <download-subfolder|ingested-file>`
   - records are appended into year-based JSON files under `TRANSACTION_CORPUS_DIR`.
   - interactive prompts and auto-LLM suggestions run by default for this workflow.

5. manage rules

   - list rules: `python tools/rules.py list`
   - add a rule: `python tools/rules.py add --regex '<pattern>' --category '<major:minor>'`
   - preview rule matches: `python tools/rules.py preview --sample 'sample text'`

CLI reference

- `python tools/ingest.py --input <download-subfolder> [--force]`
- `python tools/integrate_with_corpus.py --input <download-subfolder|ingested-file> [--dry-run]`
- `python tools/rules.py list|add|preview`

Rules storage:

- `tools/rules.json` is git-tracked and stores regex-only auto-categorization rules nested by `major:minor` category.
- Sample CSVs may live in `tools/sample_data/test/`.

Privacy:

- ingested records are written only into your external download folder and are not kept in git.
- only `TRANSACTION_CORPUS_DIR` and `tools/rules/rules.json` are required by the repo-managed tool set.
