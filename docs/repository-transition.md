# Repository Transition: Legacy App -> Umbrella Repo

## Summary

This repository was transitioned from a single legacy personal-finance
application into a long-term umbrella repository for a multi-part project.

The legacy application code is no longer active in the working tree. Legacy
behavior and implementation remain recoverable through git history and a final
tag.

## Legacy preservation model

- Final legacy tag (intact pre-transition tree):
  - `legacy-final-pre-umbrella-2026-03-28`
- Full legacy source/model history remains available in git commit history.
- The only legacy files kept directly in the active tree are raw TXT artifacts
  from `tacter/`, now stored under `archive/tacter_raw/`.

## What was removed from the active tree

Removed as obsolete active code/data:

- Legacy application code (`munge.py`, `tacter/*.py`)
- Legacy ML training/inference assets (`ludwig_training/`, `inference_models/`)

These remain available by checking out history or the tag above.

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

## Shared environment contract

This umbrella repo now uses a root `.env` contract shared by tools and apps.
A sample file is provided at `.env.example`.

Expected variables:

- `TRANSACTION_CORPUS_DIR`: local JSON corpus directory
- `TRANSACTION_DOWNLOADS_UNPROCESSED_DIR`: directory for unprocessed downloaded transaction CSV files
- `TRANSACTION_DOWNLOADS_PROCESSED_DIR`: directory for CSV files after they are processed
