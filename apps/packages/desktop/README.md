# `@txn/desktop`

Electron + Vite + React shell for **Steinfeld Finance - Hello** (the shared desktop platform scaffold).

- **Security**: `contextIsolation`, sandboxed renderer, narrow `contextBridge` API (`window.platform`).
- **Mode**: Reader-only manifest (`readerCapabilities` from `@txn/app-contracts`); no mutation IPC in preload.
- **Scripts**: `pnpm dev`, `pnpm build`, `pnpm package` (see [development.md](../../docs/development.md)).

## App icon (Windows / packaging)

This app uses **`build/hello.png`** (see [App icons](../../docs/development.md#app-icons-material-symbols)). `package.json` `build.icon` references that file; `electron-builder` generates `.ico` and other platform assets from it.
