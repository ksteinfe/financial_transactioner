# Transaction Corpus — `apps/` workspace

## TL;DR — Multiple apps, one monorepo

This directory holds **runnable applications** ([`applications/`](applications/)), **shared libraries** ([`libraries/`](libraries/)), and **shared domain packages** ([`packages/`](packages/)). **Steinfeld Finance - Hello** and **Steinfeld Finance - Sankey** are **separate Electron products**: separate `package.json` names (`@txn/hello`, `@txn/sankey`), separate **versions**, separate **dev/build/package commands**, and separate **GitHub release tags**. Shared code (types, corpus-core, UI primitives) is consumed by both; you do **not** need to release both apps when you change only one.

**Testing (from `apps/`):**

```bash
pnpm install
pnpm dev                    # Hello — interactive dev
pnpm dev:sankey             # Sankey — interactive dev
pnpm --filter @txn/sankey test   # Sankey unit tests (Vitest)
```

**Publishing to GitHub Releases:** bump version in the **app’s** `applications/<name>/package.json`, then tag and push using **that app’s** prefix — see **[docs/releases.md](docs/releases.md)** (full step-by-step commands for Hello and Sankey).

**Local installers without upload:**

```bash
pnpm --filter @txn/hello package
pnpm --filter @txn/sankey package
```

---

## What lives where

| Area | Path | Purpose |
|------|------|---------|
| **Applications** | [`applications/`](applications/) | One folder per **product** you can run or release (Electron apps, future web apps, CLIs). Each has its own `package.json` and npm name `@txn/<folder>`. |
| **Libraries** | [`libraries/`](libraries/) | Cross-app **contracts and types** (`@txn/types`, `@txn/app-contracts`). Most apps depend on these. |
| **Packages** | [`packages/`](packages/) | **Reusable domain modules** shared by one or more apps (`@txn/corpus-core`, `@txn/category-colors`, …). Not tied to a single UI. |

See **[applications/README.md](applications/README.md)** for naming rules and how future apps would be added.

## Documentation

- [docs/README.md](docs/README.md) — index of platform docs
- [docs/architecture.md](docs/architecture.md) — layers, reader vs editor apps, corpus boundary
- [docs/category-colors.md](docs/category-colors.md) — category display colors (`@txn/category-colors`)
- [docs/capability-model.md](docs/capability-model.md) — app manifests and capabilities
- [docs/updates.md](docs/updates.md) — auto-update behavior and environment variables
- [docs/releases.md](docs/releases.md) — **tag-only GitHub Releases** (Hello + Sankey): TL;DR, tags, CI
- [docs/development.md](docs/development.md) — **TL;DR**, install, run, build, test, package, troubleshooting
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — apps workspace and repo maintenance log

## Quick start

From this directory:

```bash
pnpm install
pnpm dev
```

That runs **`@txn/hello`** (Steinfeld Finance - Hello) in development mode (Electron + Vite).

**Steinfeld Finance - Sankey** (`@txn/sankey`): `pnpm dev:sankey` from this directory (or `pnpm --filter @txn/sankey dev`).

Root [package.json](package.json) shortcuts: `dev:sankey`, `build:sankey`, `package:sankey`.

## Corpus and environment

The **transaction corpus** is a local folder of yearly JSON files on disk; it is **not** committed to git.

Repository-wide paths are configured at the **repository root** via `.env` (copy from `.env.example`):

- `TRANSACTION_CORPUS_DIR` — corpus directory
- `TRANSACTION_DOWNLOADS_UNPROCESSED_DIR` / `TRANSACTION_DOWNLOADS_PROCESSED_DIR` — ingestion pipeline (used by `tools/`)

Apps resolve corpus access through the **main process** and **preload** IPC (not raw filesystem access from the renderer).

**Data loading preference:** when implementing features that need aggregates (totals by year/month/category), **prefer the derived `corpus-summary.json`** in the corpus root over re-reading every `YYYY.json` file. It reduces I/O and parsing cost; use yearly files when you need individual transactions or fields not present in the summary. Contract and rebuild rules: [`../../docs/corpus-format.md`](../../docs/corpus-format.md) (summary section). Shared logic lives in `@txn/corpus-core`; the hello app displays summary rollups and can rebuild the file from the UI.

## Legacy reference

Domain vocabulary for categories and accounts remains in:

- `../reference/legacy-domain/`
