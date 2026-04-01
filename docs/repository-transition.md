# Repository Transition: Legacy App -> Umbrella Repo

## Summary

This repository was transitioned from a single legacy personal-finance
application into a long-term umbrella repository for a multi-part project.

The legacy application code is no longer active in the working tree. Legacy
behavior and implementation remain recoverable through git history and a final
tag.

## Legacy preservation model

- Optional git tag (may still exist on the remote):
  - `legacy-final-pre-umbrella-2026-03-28`
- The only legacy files kept directly in the active tree are raw TXT artifacts
  from `tacter/`, now stored under `archive/tacter_raw/`.

## What was removed from the active tree

Removed as obsolete active code/data:

- Legacy application code (`munge.py`, `tacter/*.py`)
- Legacy ML training/inference assets (`ludwig_training/`, `inference_models/`)

## History maintenance (2026)

The **`inference_models/`** tree (training metadata and model binaries that
should not be published) was **stripped from all git history** using
`git filter-repo` and a force-pushed rewrite. It is **no longer** present in any
reachable commit in this repository. Recovery of those blobs, if needed, is
only from **out-of-band backups**, not from GitHub.

Older documentation may still refer to “checking out the legacy tag” for the
full pre-umbrella tree; that no longer includes `inference_models/`.

## What was preserved directly

Raw historical artifacts (verbatim copies):

- `archive/tacter_raw/categories_allowed.txt`
- `archive/tacter_raw/xform_category.txt`
- `archive/tacter_raw/xform_description.txt`

## Extracted domain reference artifacts

Useful structured legacy vocabulary was extracted into
`reference/legacy-domain/`:

- account enum values
- category taxonomy
- source-category mappings
- description-pattern mappings
- normalized transaction field vocabulary and legacy parser conventions

These files are cleaned references intended to support new implementations
without retaining obsolete code.

## New active repository purpose

1. Build ingestion/normalization tooling for downloaded bank transactions.
2. Integrate results into a local JSON corpus configured by shared environment
   variables.
3. Build applications (likely JavaScript/Electron) for corpus visualization and
   maintenance.

## Apps workspace layout (`apps/`)

The **`apps/`** directory is a **pnpm workspace** of Node packages:

- **`applications/`** — one folder per runnable product (for example **`applications/hello/`** is **`@txn/hello`**, Steinfeld Finance - Hello). Future apps get their own subdirectory and package name **`@txn/<slug>`**.
- **`libraries/`** — shared **types** and **app-contracts** consumed by multiple apps (`@txn/types`, `@txn/app-contracts`).
- **`packages/`** — reusable **domain modules** not tied to a single UI (`@txn/corpus-core`, `@txn/category-colors`, …).

Authoritative overview: [apps/README.md](../apps/README.md) and [apps/applications/README.md](../apps/applications/README.md). Platform docs (architecture, releases, category colors) live under **`apps/docs/`**.

## Shared environment contract

This umbrella repo now uses a root `.env` contract shared by tools and apps.
A sample file is provided at `.env.example`.

Expected variables:

- `TRANSACTION_CORPUS_DIR`: local JSON corpus directory
- `TRANSACTION_DOWNLOADS_UNPROCESSED_DIR`: directory for unprocessed downloaded transaction CSV files
- `TRANSACTION_DOWNLOADS_PROCESSED_DIR`: directory for CSV files after they are processed
