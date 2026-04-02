# Changelog — apps workspace & related repo work

This log records **maintainer-facing** changes to the **`apps/`** workspace (Electron apps, shared libraries and packages), release automation, and umbrella-repo hygiene. **Released app versions** for Steinfeld Finance - Hello are defined in [`applications/hello/package.json`](../applications/hello/package.json) and published via tags `steinfeld-finance-hello-v*`.

---

## Unreleased / current tree

- **Version:** see `applications/hello/package.json` `version` (e.g. **0.1.4** at last documentation pass). **Sankey:** `applications/sankey/package.json` (**@txn/sankey**), releases via tags `steinfeld-finance-sankey-v*`.
- **Upcoming:** repository may be switched **public** for anonymous GitHub Releases / auto-updates (private repos require `GH_TOKEN` for the updater feed).

### Steinfeld Finance - Sankey (2026-04)

- **New app:** `applications/sankey` — **`@txn/sankey`**, Electron + D3 Sankey (main / reimbursement / transfer sections), corpus via **`platform:loadCorpusYearFile`**, **`@txn/ui-core`** canvas + month range, **`@txn/category-colors`** for category nodes, tests (`pnpm --filter @txn/sankey test`).
- **`@txn/corpus-core/pure`:** browser-safe subpath (no `fs`) for renderer imports; full package unchanged for main process.
- **CI:** [`.github/workflows/release-steinfeld-finance-sankey.yml`](../../.github/workflows/release-steinfeld-finance-sankey.yml).

#### Sankey UI iteration (same release line; **known issues**)

- **Model / layout:** Transfer section **omits major-category nodes**; flow is inflow minors → total inflow → total outflow → outflow minors. Middle nodes ordered with **total inflow before deficit** and **total outflow before surplus**; **`adjustStackedBalances`** places deficit under total inflow and surplus under total outflow.
- **Theme:** Light app chrome and **very light grey** canvas background (`--txn-canvas-bg` / sankey styles).
- **`@txn/ui-core` `AppCanvas`:** Optional **`toolbarExtra`** (e.g. **Reset node positions** next to Fit / Reset view); transparent **pan hit rect** with explicit bounds; **`touch-action: none`** on zoom SVG; zoom filter tweaks for wheel vs pan.
- **`SankeyChart`:** Renders as **`<g>`** inside the canvas (no nested root `<svg>`); link paths with minimum stroke width and semantic stroke color; **pointer `stopPropagation`** on node drag to avoid conflating node drag with canvas pan.
- **Still broken or unverified in the live Electron app (2026-04 session end):** **Pan and zoom** do not behave correctly for users; **Sankey links** are **not reliably visible**; **no automated check** yet that on-screen node labels/amounts match underlying `SankeySectionModel` / corpus rows — see **[sankey-app.md](sankey-app.md)** for investigation checklist and verification ideas.

### Documentation & workspace layout (2026-04)

- **Structure:** Documented the split between **`applications/`** (runnable products such as `@txn/hello`), **`libraries/`** (`@txn/types`, `@txn/app-contracts`), and **`packages/`** (domain modules). Root [docs/repository-transition.md](../../docs/repository-transition.md) and [apps/README.md](../README.md) are the primary references; [applications/README.md](../applications/README.md) describes adding future apps.
- **Category colors:** New [category-colors.md](category-colors.md) describes **`@txn/category-colors`**: theme JSON (`majors`, `labBounds`, `explicit` with **major-only** and full-path keys), resolution order, and the hello app Category colors panel. Cross-links from [architecture.md](architecture.md), [corpus-format.md](../../docs/corpus-format.md), [`@txn/corpus-core` README](../packages/corpus-core/README.md), and [hello README](../applications/hello/README.md).
- **`@txn/category-colors` behavior:** If **`explicit["major"]`** is set, all minors under that major inherit that hex unless **`explicit["major:minor"]`** overrides a row; default theme consolidates **`unknown`** minors via a single major-level explicit entry.

### Corpus summary & hello app (2026-04)

- **Contract:** [`docs/corpus-format.md`](../../docs/corpus-format.md) documents optional transaction `notes` and the derived **`corpus-summary.json`** (year / month / category rollups, rebuild protocol).
- **`@txn/corpus-core`:** `computeCorpusSummary`, `rebuildCorpusSummaryFile`, constants for filename and schema version; aggregates from all `YYYY.json` files.
- **`@txn/types`:** `CorpusTransaction`, `CorpusSummaryDocument`, load/rebuild result types for IPC.
- **Steinfeld Finance - Hello:** reads `corpus-summary.json` via **`platform:getCorpusSummary`**; shows per-year inflow/outflow/net, last rebuild time, schema version, and **Rebuild summary** (**`platform:rebuildCorpusSummary`**). Year scan table unchanged.
- **Guidance:** new and future apps should **use `corpus-summary.json` when possible** for dashboards and rollups; load `YYYY.json` only when row-level data is required.

---

## 2026-03-31 — Steinfeld Finance - Hello hardening & release pipeline

### Product & packaging

- Renamed the Windows/desktop product to **Steinfeld Finance - Hello** with slug **`steinfeld-finance-hello`** for artifact / executable naming (`electron-builder`: `productName`, `artifactName`, `win.executableName`, `appId`).
- Replaced the **moneylooksee** naming and **`moneylooksee-hello-v*`** tag convention with **`steinfeld-finance-hello-v*`**; CI workflow [`.github/workflows/release-steinfeld-finance-hello.yml`](../../.github/workflows/release-steinfeld-finance-hello.yml) and [releases.md](releases.md) updated accordingly.
- **Icons:** `build/hello.png` as source for packaging; [NSIS](https://www.electron.build/configuration/nsis) **must not** use PNG for `installerIcon` / `uninstallerIcon` (use defaults from `build.icon` or supply `.ico`); fixed installer failure on CI.
- **Main process:** `BrowserWindow` **icon** resolved for packaged Windows (`resources` `.ico`) and dev (`build/hello.png`); removed stray **`mainWindow`** assignment that caused startup `ReferenceError`.
- **Settings file** renamed to `steinfeld-finance-hello-settings.json` (userData).

### Auto-update & observability

- **GitHub Releases** feed: documented that **private** repos return **404** for unauthenticated updater requests; options are **public repo** or **`GH_TOKEN` / `GITHUB_TOKEN`** for testing private feeds ([updates.md](updates.md)).
- Added **`[autoUpdater]`** main-process logging (startup line, `checking-for-update`, `update-not-available`, errors) and **`TXN_UPDATE_DEBUG`** for verbose logs; clarified **DevTools = renderer** vs **terminal = main** ([updates.md](updates.md)).

### Repository history (privacy)

- **`inference_models/`** (legacy Ludwig / training metadata and binaries) **removed from all reachable git history** using **`git filter-repo`** (`--path inference_models/ --invert-paths`), then **`git push --force --all`** / tags to GitHub. Old clones must **re-clone** or hard-reset to the new history.
- **`legacy-final-pre-umbrella-2026-03-28`:** tag may still exist as a pointer; sensitive ML paths are **not** present in rewritten commits. Optional: delete the tag on the remote if you do not want a named legacy pointer at all.
- **Reference docs** intentionally retain legacy account suffix notes under `reference/legacy-domain/` (e.g. **2955** / **2232**) as non-secret vocabulary; see [repository-transition.md](../../docs/repository-transition.md).

### Release versions (tag namespace)

Tags **`steinfeld-finance-hello-v0.1.x`** (and related) track CI-published installers; bump **`package.json` `version`**, commit, then:

`git tag steinfeld-finance-hello-vX.Y.Z` and `git push origin steinfeld-finance-hello-vX.Y.Z` per [releases.md](releases.md).

---

## Earlier

- Umbrella transition and legacy extraction are described in the repo root [docs/repository-transition.md](../../docs/repository-transition.md) and [README.md](../../README.md).
