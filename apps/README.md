# Transaction Corpus — `apps/` workspace

This directory holds **everything that ships as Node packages** for Steinfeld Finance tooling: **runnable applications**, **shared libraries** (types and contracts), and **shared domain packages** (corpus logic, colors, etc.).

## What lives where

| Area | Path | Purpose |
|------|------|---------|
| **Applications** | [`applications/`](applications/) | One folder per **product** you can run or release (Electron apps, future web apps, CLIs). Each has its own `package.json` and npm name `@txn/<folder>`. |
| **Libraries** | [`libraries/`](libraries/) | Cross-app **contracts and types** (`@txn/types`, `@txn/app-contracts`). Most apps depend on these. |
| **Packages** | [`packages/`](packages/) | **Reusable domain modules** shared by one or more apps (`@txn/corpus-core`, `@txn/category-colors`, …). Not tied to a single UI. |

See **[applications/README.md](applications/README.md)** for naming rules and how future apps (for example **sankey**, **second**) would be added.

## Documentation

- [docs/README.md](docs/README.md) — index of platform docs
- [docs/architecture.md](docs/architecture.md) — layers, reader vs editor apps, corpus boundary
- [docs/category-colors.md](docs/category-colors.md) — category display colors (`@txn/category-colors`)
- [docs/capability-model.md](docs/capability-model.md) — app manifests and capabilities
- [docs/updates.md](docs/updates.md) — auto-update behavior and environment variables
- [docs/releases.md](docs/releases.md) — tag-only GitHub Releases (CI) for Steinfeld Finance - Hello
- [docs/development.md](docs/development.md) — prerequisites, install, run, build
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — apps workspace and repo maintenance log

## Quick start

From this directory:

```bash
pnpm install
pnpm dev
```

That runs **`@txn/hello`** (Steinfeld Finance - Hello) in development mode (Electron + Vite).

## Corpus and environment

The **transaction corpus** is a local folder of yearly JSON files on disk; it is **not** committed to git.

Repository-wide paths are configured at the **repository root** via `.env` (copy from `.env.example`):

- `TRANSACTION_CORPUS_DIR` — corpus directory
- `TRANSACTION_DOWNLOADS_UNPROCESSED_DIR` / `TRANSACTION_DOWNLOADS_PROCESSED_DIR` — ingestion pipeline (used by `tools/`)

The hello app resolves corpus access through the **main process** and **preload** IPC (not raw filesystem access from the renderer).

**Data loading preference:** when implementing features that need aggregates (totals by year/month/category), **prefer the derived `corpus-summary.json`** in the corpus root over re-reading every `YYYY.json` file. It reduces I/O and parsing cost; use yearly files when you need individual transactions or fields not present in the summary. Contract and rebuild rules: [`../../docs/corpus-format.md`](../../docs/corpus-format.md) (summary section). Shared logic lives in `@txn/corpus-core`; the hello app displays summary rollups and can rebuild the file from the UI.

## Legacy reference

Domain vocabulary for categories and accounts remains in:

- `../reference/legacy-domain/`
