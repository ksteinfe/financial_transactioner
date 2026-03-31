# Transaction Corpus — Desktop platform (`apps/`)

This directory is the **Electron desktop platform** workspace: a shared shell that can host multiple internal features (and eventually separate distributables), built on TypeScript and React.

## Documentation

- [docs/README.md](docs/README.md) — index of platform docs
- [docs/architecture.md](docs/architecture.md) — layers, reader vs editor apps, corpus boundary
- [docs/capability-model.md](docs/capability-model.md) — app manifests and capabilities
- [docs/updates.md](docs/updates.md) — auto-update behavior and environment variables
- [docs/releases.md](docs/releases.md) — tag-only GitHub Releases (CI) for Steinfeld Finance - Hello
- [docs/development.md](docs/development.md) — prerequisites, install, run, build

## Quick start

From this directory:

```bash
pnpm install
pnpm dev
```

That runs the `@txn/desktop` package in development mode (Electron + Vite).

## Repository layout (within `apps/`)

- `packages/desktop` — Electron main/preload/renderer shell (hello-world and future features)
- `packages/types` — shared canonical types (stubs grow here)
- `packages/app-contracts` — manifests, capability profiles, IPC-facing contracts
- `packages/corpus-core`, `corpus-electron`, `ui-core`, `test-fixtures` — reserved; see each package README

## Corpus and environment

The **transaction corpus** is a local folder of yearly JSON files on disk; it is **not** committed to git.

Repository-wide paths are configured at the **repository root** via `.env` (copy from `.env.example`):

- `TRANSACTION_CORPUS_DIR` — corpus directory
- `TRANSACTION_DOWNLOADS_UNPROCESSED_DIR` / `TRANSACTION_DOWNLOADS_PROCESSED_DIR` — ingestion pipeline (used by `tools/`)

The desktop app will resolve corpus access through the **main process** and **preload** IPC (not raw filesystem access from the renderer). The hello-world build does not yet load corpus data.

## Legacy reference

Domain vocabulary for categories and accounts remains in:

- `../reference/legacy-domain/`
