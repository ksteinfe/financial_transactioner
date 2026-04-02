# `@txn/corpus-core`

**Layer 3** — pure TypeScript corpus logic: scanning yearly JSON files, building the derived summary index, validation, and (later) queries and mutations.

Depends on `@txn/types`. Uses Node `fs`; safe to unit-test with temp directories. No Electron imports.

**Consumption guidance:** UIs and tools that only need **totals and category rollups** should load **`corpus-summary.json`** (via `computeCorpusSummary` / a file read) instead of parsing every `YYYY.json`. Reserve full year-file reads for transaction lists, edits, and ingestion. See repo root **`docs/corpus-format.md`** (corpus summary section). **Per-category display colors** are provided by sibling package **`@txn/category-colors`**; see **`apps/docs/category-colors.md`**.

Exports:

- `scanCorpusDirectory(rootPath)` — discover `YYYY.json` files, count `transactions.length`, report diagnostics.
- `computeCorpusSummary` / `writeCorpusSummaryFile` / `rebuildCorpusSummaryFile` — build or refresh the derived **`corpus-summary.json`** index (see `docs/corpus-format.md` section 9).
- `CORPUS_SUMMARY_FILENAME`, `CORPUS_SUMMARY_SCHEMA_VERSION`, `DEFAULT_MAJOR_CATEGORY_KEYS`.
- **`@txn/corpus-core/pure`** — browser-safe entry (no `node:fs`): `parseCorpusYearFile`, `parseCategory`, `filterTransactionsByYearMonthRange`, `aggregateByCategory`, `sectionForCategory`, Sankey partition helpers, etc. Use from Electron **renderers**; keep full `@txn/corpus-core` in main/process tooling.
