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

The complete pre-transition codebase is preserved by git history and a final
tag:

- `legacy-final-pre-umbrella-2026-03-28`

See `docs/repository-transition.md` for details.

## Getting started

- Read `docs/repository-transition.md` for context.
- Review `reference/legacy-domain/` for extracted legacy vocabulary.
- Start new implementation work in `tools/` and `apps/`.
