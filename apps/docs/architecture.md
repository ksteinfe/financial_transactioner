# Architecture

This document summarizes the desktop platform shape. Visualization libraries are **per feature** (D3, ECharts, etc.); shared code stays **data- and policy-oriented**, not chart-library-specific.

## External storage (layer 0)

- **Corpus**: a user-selected directory on disk, holding yearly JSON files (see repo `docs/corpus-format.md`). It lives outside the repository and outside the installed app bundle.
- **App-local state**: preferences, recent corpus locations, caches, logs, temp files — managed by the platform, not mixed with corpus files.

## Electron main process (layer 1)

Owns window lifecycle, application menu, native dialogs (e.g. folder picker), filesystem access, update checks, persisted settings, IPC handlers, optional file watching, and **write coordination** for editor-capable surfaces.

No visualization logic belongs here.

## Preload bridge (layer 2)

Exposes a **minimal, typed API** to the renderer via `contextBridge` with `contextIsolation: true`.

Do **not** expose raw `fs`, full `ipcRenderer`, or unrestricted channels. Mutation-related IPC should only be registered for **explicitly designated editor** surfaces.

### Corpus refresh (`rescanCorpus`)

Apps should refresh views when yearly JSON files change on disk. The preload API includes **`rescanCorpus()`**: the main process re-reads the **persisted** corpus directory from app settings and returns a fresh `CorpusScanSummary` (via `@txn/corpus-core`). Typical use: **on load** if a corpus path is saved, after **manual “Rescan”**, or after tools write new `YYYY.json` files. Arbitrary paths still use **`scanCorpus(path)`** (e.g. immediately after **Choose folder** before persistence).

## Shared domain / core (layer 3)

Pure TypeScript where possible, testable outside Electron. Responsibilities include canonical corpus types, runtime validation, scanning/loading, query and aggregation, mutation rules, and diagnostics.

`libraries/` (`types`, `app-contracts`) and `packages/` (`corpus-core`, `category-colors`, …) implement or stub these boundaries; see [apps/README.md](../README.md).

**Category display colors** are not corpus data; **`@txn/category-colors`** maps canonical `major:minor` strings to hex using a bundled theme and `reference/allowed-categories.json`. See [category-colors.md](category-colors.md).

## App shell (layer 4)

React (or similar) shell: routes, panels, filters, loading/error states, commands, app-specific settings, and **explicit UI** for mode (e.g. “Reader” vs “Editor”).

## Visualization adapter (layer 5)

Per-area choice of D3, ECharts, or other libraries. The shared layer returns **semantic data**; the shell builds **view models**; the visualization layer renders them.

## Reader apps vs editor apps

The platform is **not** globally read-only.

- **Reader apps** (or reader surfaces): may query and visualize the corpus; must not mutate it.
- **Editor apps** (or editor surfaces): may mutate the corpus **only** through a **single shared mutation service** and validation rules — not ad hoc writes from the renderer.

This distinction must be explicit in **code**, **manifests**, **preload exposure**, and **UI**.

## Practical deployment: one shell, many views

The first deliverable was **one Electron app** with **multiple internal views/routes**. Additional products (for example **Steinfeld Finance - Sankey**) ship as **separate Electron apps** in `applications/` with their own versioning, installers, and GitHub Releases tag prefixes, while reusing the same `libraries/` and `packages/` layers.
