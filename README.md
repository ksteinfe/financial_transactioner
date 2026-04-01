# Repository Umbrella: Transaction Corpus Platform

This repository has been restructured into a long-term umbrella repo for a
multi-part personal-finance data project.

## New purpose

The active project direction is:

1. Build tools to process downloaded bank/credit-card transactions.
2. Integrate processed data into a local JSON corpus that is **not committed to
   git**.
3. Build multiple applications (likely JavaScript/Electron) for visualizing and
   maintaining that corpus.

## Repository layout

- `archive/`
  - Historical artifacts retained in the active tree.
  - Includes raw TXT files from the legacy `tacter` directory only.
- `reference/`
  - Extracted domain vocabulary from legacy code/data (enums, mappings,
    category taxonomy, transaction field semantics).
- `tools/`
  - Transaction ingestion/transformation tooling (new work area).
- `apps/`
  - UI applications for visualization and maintenance (new work area).
- `docs/`
  - Transition docs, repository charter, and architecture notes.

## Legacy preservation

Raw `tacter` TXT artifacts live under `archive/tacter_raw/`. Structured legacy
vocabulary is under `reference/legacy-domain/`.

A **legacy umbrella tag** (`legacy-final-pre-umbrella-2026-03-28`) may still
exist as a git pointer; **legacy ML / inference assets** (`inference_models/`)
were **removed from git history** in a 2026 maintenance pass and are **not**
recoverable from this repository (keep a separate backup if needed).

See `docs/repository-transition.md` for details.

## Getting started

- Read `docs/repository-transition.md` for context.
- Review `reference/legacy-domain/` for extracted legacy vocabulary.
- Start new implementation work in `tools/` and `apps/`.
- **Desktop app releases (tag-only, GitHub Actions):** see [apps/docs/releases.md](apps/docs/releases.md).
- **What changed recently (desktop + repo hygiene):** [apps/docs/CHANGELOG.md](apps/docs/CHANGELOG.md).

## Shared environment configuration

All tools and apps should read data-directory locations from the root `.env`.

1. Copy `.env.example` to `.env`.
2. Set absolute paths for your local machine:
   - `TRANSACTION_CORPUS_DIR`
   - `TRANSACTION_DOWNLOADS_UNPROCESSED_DIR`
   - `TRANSACTION_DOWNLOADS_PROCESSED_DIR`

This provides a single, stable configuration contract across `tools/` and
`apps/`.

## Corpus data loading (apps)

Yearly transaction files live as `YYYY.json` under the corpus directory. The
derived index **`corpus-summary.json`** (see [`docs/corpus-format.md`](docs/corpus-format.md))
holds pre-aggregated rollups by year, month, and category. **Apps and tools
should read `corpus-summary.json` when possible** (dashboards, charts, high-level
totals) and fall back to scanning `YYYY.json` only when row-level detail is
required. The summary is rebuilt after writes or on demand (`@txn/corpus-core`,
desktop **Rebuild summary**).
