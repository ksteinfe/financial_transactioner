# `@txn/desktop`

Electron + Vite + React shell for **Steinfeld Finance - Hello** (the shared desktop platform scaffold).

- **Security**: `contextIsolation`, sandboxed renderer, narrow `contextBridge` API (`window.platform`).
- **Mode**: Reader-only manifest (`readerCapabilities` from `@txn/app-contracts`); no corpus mutation IPC in preload (summary rebuild is a derived-file refresh, not editing transactions).
- **Scripts**: `pnpm dev`, `pnpm build`, `pnpm package` (see [development.md](../../docs/development.md)).

## Corpus IPC

The renderer loads corpus metadata through **`window.platform`** (see `src/preload/index.ts`):

- **`scanCorpus` / `rescanCorpus`** — discover `YYYY.json` files and transaction counts (`@txn/corpus-core` `scanCorpusDirectory`).
- **`getCorpusSummary`** — read parsed **`corpus-summary.json`** from the saved corpus folder (aggregates); use this path in UI so lists and totals avoid scanning every year file.
- **`rebuildCorpusSummary`** — recompute and overwrite `corpus-summary.json` after external edits or before relying on rollups.

The hello UI shows summary rollups, last rebuild timestamp, and a rebuild button. **Prefer the summary file for aggregate views**; rescan yearly files when you need raw row counts or to validate file presence.

## App icon (Windows / packaging)

This app uses **`build/hello.png`** (see [App icons](../../docs/development.md#app-icons-material-symbols)). `package.json` `build.icon` references that file; `electron-builder` generates `.ico` and other platform assets from it.
