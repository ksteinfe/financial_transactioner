# `@txn/corpus-core`

**Layer 3** — pure TypeScript corpus logic: scanning yearly JSON files, validation, and (later) queries and mutations.

Depends on `@txn/types`. Uses Node `fs`; safe to unit-test with temp directories. No Electron imports.

Current exports:

- `scanCorpusDirectory(rootPath)` — discover `YYYY.json` files, count `transactions.length`, report diagnostics.
