# `@txn/desktop`

Electron + Vite + React shell for **moneylooksee - hello** (the shared desktop platform scaffold).

- **Security**: `contextIsolation`, sandboxed renderer, narrow `contextBridge` API (`window.platform`).
- **Mode**: Reader-only manifest (`readerCapabilities` from `@txn/app-contracts`); no mutation IPC in preload.
- **Scripts**: `pnpm dev`, `pnpm build`, `pnpm package` (see [development.md](../../docs/development.md)).
