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

- tools should read paths from repository-root `.env`
- required directories in `.env`:
  - `TRANSACTION_CORPUS_DIR`
  - `TRANSACTION_DOWNLOADS_UNPROCESSED_DIR`
  - `TRANSACTION_DOWNLOADS_PROCESSED_DIR`
- copy `.env.example` to `.env` and set local absolute paths before running tools
