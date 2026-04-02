# `@txn/sankey`

Electron + Vite + React app for **Steinfeld Finance - Sankey**: strict-flow Sankey visualization of corpus transactions by year and month range.

- **Security**: `contextIsolation`, sandboxed renderer, narrow `contextBridge` API (`window.platform`).
- **Mode**: Reader-only manifest (`readerCapabilities` from `@txn/app-contracts`); no corpus mutation IPC.
- **Data**: Year files via `loadCorpusYearFile(year)`; renderer imports **`@txn/corpus-core/pure`** (no Node `fs` in the bundle). Main process uses full `@txn/corpus-core`.
- **UI**: `@txn/ui-core` (`AppCanvas`, `YearMonthRangeSelector`), D3 + `d3-sankey`, `@txn/category-colors` for category nodes.
- **Scripts**: `pnpm dev`, `pnpm build`, `pnpm package`, `pnpm test` (see [development.md](../../docs/development.md)).
- **Maintainer notes (layout, known issues, data verification):** [sankey-app.md](../../docs/sankey-app.md).

## Icon (Windows / packaging)

Uses **`build/sankey.png`** (see [App icons](../../docs/development.md#app-icons-material-symbols)). For release, prefer a dedicated Material Symbol (e.g. flow/account-tree) at 512px, `#808080`.
