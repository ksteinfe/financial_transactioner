# financial_transactioner

## Purpose of this repository (documenting current state)

This repository is a personal-finance transaction normalization and
categorization toolchain. It ingests exported bank/credit-card CSV files from
multiple institutions, converts them into a common transaction format, applies
rule-based category mapping, and (optionally) uses a pre-trained Ludwig model
to infer categories for unresolved rows.

This README intentionally describes the **current, pre-rebuild** state of the
project as a baseline snapshot before the planned teardown and rewrite.

## What the project currently does

At a high level, the current pipeline is:

1. Read CSV files from a source directory.
2. Detect each file's account/institution format from headers and filename.
3. Parse rows into a normalized transaction shape:
   - `date`
   - `amnt`
   - `acnt` (normalized account enum)
   - `desc`
   - optional source fields (for example `_catg` and trust flags)
4. Resolve categories via rules:
   - allowed category list
   - source-category transforms
   - description substring transforms
5. Optionally run ML inference to predict categories and attach confidence
   probabilities.
6. Write a sorted `out.csv` with resolved and inferred fields.

## Repository structure

- `munge.py`
  - CLI entrypoint that processes a directory of CSV files.
  - Calls `tacter.process_csv.do_process_directory(...)`.
- `tacter/process_csv.py`
  - Core ETL/normalization pipeline.
  - Handles file discovery, format detection, parsing, categorization, optional
    inference, and output generation.
- `tacter/categorize.py`
  - Rule-based categorization logic and loaders for mapping files.
- `tacter/account.py`
  - Account enum used to normalize institution/account identity.
- `tacter/infer.py`
  - Ludwig model loading/prediction wrapper.
- `tacter/categories_allowed.txt`
  - Canonical allowed category taxonomy.
- `tacter/xform_category.txt`
  - Mapping from source categories to canonical categories.
- `tacter/xform_description.txt`
  - Mapping from description substrings to canonical categories.
- `ludwig_training/model_def.yaml`
  - Ludwig training config (input/output feature schema + training settings).
- `inference_models/190423/`
  - Archived trained model artifacts and training metadata/statistics used for
    inference.

## Current model/data snapshot in-repo

The checked-in historical model snapshot (`inference_models/190423`) includes:

- a trained Ludwig model (`model/` weights + metadata),
- training statistics (`training_statistics.json`),
- run description/config metadata (`description.json`).

From the stored metadata:

- training set appears to contain **8,227** labeled records,
- output vocabulary includes roughly **74 category classes** (+ `<UNK>`),
- account vocabulary used in training includes:
  - `primary_checking` (6,144)
  - `boa_visa` (1,715)
  - `capital_one` (368)
- historical performance in `training_statistics.json` is around:
  - best validation accuracy: **~0.81**
  - best test accuracy: **~0.81**

These values are documented to describe current artifacts, not as a claim of
production readiness.

## Notable characteristics and limitations of the current implementation

- Format detection is heuristic and fragile (header/filename string matching).
- Parsing logic is institution-specific and hard-coded.
- The CLI currently sets `inference_model_path = False` by default in
  `munge.py`, so inference is effectively disabled unless code is changed.
- Some paths/examples in code are Windows-specific historical paths.
- The codebase reflects an older Ludwig API/version era and should be treated
  as archival behavior documentation.
- There are no automated tests in this snapshot.

## Why this documentation exists

This document is a **current-state capture** intended to preserve project
intent and behavior before a full rebuild. The rebuild can use this as a
reference for:

- supported inputs,
- normalization/categorization semantics,
- legacy model artifact context,
- and known pain points to address in the new architecture.
