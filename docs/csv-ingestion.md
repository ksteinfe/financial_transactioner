# CSV Ingestion and Normalization Contract

This document specifies the contract for ingesting downloaded bank `.csv` files
into the shared yearly JSON corpus (see `docs/corpus-format.md`).

It is grounded in extracted legacy behavior from:

- Historical `tacter/process_csv.py` behavior (legacy app; not in active tree; see `docs/repository-transition.md`)
- `reference/legacy-domain/category_mapping_legacy_to_canonical.tsv`
- `reference/legacy-domain/description_mapping_legacy_to_canonical.tsv`
- `reference/legacy-domain/accounts.json`

Normative terms:

- **MUST / MUST NOT** = required
- **SHOULD / SHOULD NOT** = strongly recommended
- **MAY** = optional

## 1) Input scope

- Input files are downloaded `.csv` files from supported institutions.
- CSV formats are not uniform across institutions.
- Ingestion MUST treat format detection and parsing as bank-specific.
- Bank-provided category columns (for example `Category`) are **non-authoritative**
  and MUST NOT be written directly to corpus `category`.

Supported source identifiers (from filename):

- `boa` -> **Bank of America**
- `capone` -> **Capital One**
- `chase` -> **Chase**

Filename matching MUST be case-insensitive.

## 2) Required sample CSVs (fake values)

These examples anchor the contract and test fixtures.

### 2.1 Chase sample

```csv
Date,Description,Amount,Category,Account Name
01/10/2026,TRADER JOE'S #123,-54.23,Groceries,Chase Checking
01/09/2026,Payroll Deposit,2500.00,Income,Chase Checking
```

### 2.2 Capital One sample

```csv
Transaction Date,Posted Date,Description,Category,Debit,Credit
01/10/2026,01/11/2026,STARBUCKS STORE 1234,Food & Drink,5.75,
01/09/2026,01/09/2026,SALARY PAYMENT,Income,,2500.00
```

### 2.3 Bank of America sample

```csv
Date,Description,Amount,Running Balance
01/10/2026,AMAZON.COM,-23.45,1200.55
01/09/2026,DIRECT DEPOSIT,2500.00,1223.00
```

## 3) Legacy ingestion extraction summary

Extracted from legacy `tacter/process_csv.py`:

1. Source/category detection used CSV-header prefixes and filename substrings.
2. Parsing rules were bank-specific:
   - Chase used a signed `Amount`.
   - Capital One used separate `Debit`/`Credit` columns.
   - BoA checking used signed `Amount`; skipped "Beginning balance" rows.
3. Canonical category resolution combined:
   - source category mapping (`xform_category.txt`),
   - description substring mapping (`xform_description.txt`).
4. Legacy code did **not** implement a formal dedup/merge strategy into a
   persisted JSON corpus; that must be defined now.

## 4) Source identification contract

### 4.1 Primary source identification (required)

Source bank MUST be inferred from filename token:

- contains `boa` -> `bank_of_america`
- contains `capone` -> `capital_one`
- contains `chase` -> `chase`

If none match, ingestion MUST fail with an explicit unsupported-source error.

### 4.2 Legacy compatibility fallback (optional but recommended)

If filename token is missing/ambiguous, tools MAY use legacy header clues:

- starts with `transaction date,posted date` -> Capital One
- starts with `transaction date,post date` -> Chase
- starts with `description,,summary` -> BoA checking (legacy export variant)
- starts with `posted date,reference number` -> BoA credit card variants

## 5) Per-bank parsing rules

## 5.1 Chase

Expected columns (current contract):

- `Date`
- `Description`
- `Amount`
- `Category`
- `Account Name`

Parsing:

- Date format: `%m/%d/%Y` -> normalize to `YYYY-MM-DD`.
- Amount: `Amount` is signed numeric.
  - negative = debit
  - positive = credit
- Description: trim surrounding whitespace.
- Source category candidate: `Category` (non-authoritative; store as
  `source_category` signal only).
- Account normalization: derive canonical account id from `Account Name` and/or
  filename metadata.

Legacy note:

- Legacy parser used header `Transaction Date,...` and `%m/%d/%Y`. Treat header
  naming differences (`Date` vs `Transaction Date`) as acceptable variants.

## 5.2 Capital One

Expected columns:

- `Transaction Date`
- `Posted Date`
- `Description`
- `Category`
- `Debit`
- `Credit`

Parsing:

- Date: use `Transaction Date` for `date`.
- Amount:
  - if `Debit` has value -> `amount = -abs(Debit)`
  - else if `Credit` has value -> `amount = +abs(Credit)`
  - else -> fail row validation
- Description: trim surrounding whitespace.
- Source category candidate: `Category` (non-authoritative; store as
  `source_category` signal only).

Legacy mismatch (explicit uncertainty):

- Legacy code parsed Capital One `Transaction Date` as `%Y-%m-%d`, while this
  contract sample uses `%m/%d/%Y`. Implementations SHOULD accept both formats
  (strictly parsed) and normalize to `YYYY-MM-DD`.

## 5.3 Bank of America

Expected columns (checking/deposit account contract):

- `Date`
- `Description`
- `Amount`
- `Running Balance`

Parsing:

- Date format: `%m/%d/%Y`.
- Amount: signed numeric from `Amount`.
- Row filter: if first data row description starts with `Beginning balance`,
  row SHOULD be skipped (legacy compatibility).
- Source category candidate: none required from CSV (category may be empty in
  BoA exports).

Legacy compatibility note:

- Legacy BoA checking exports included non-tabular preamble lines and
  `description,,summary` header patterns. Modern parsers SHOULD support both
  clean tabular CSVs (contract sample) and legacy preamble-style exports.

## 6) Normalized transaction shape (CSV -> normalized -> corpus)

Each parsed CSV row MUST be normalized into this intermediate object:

```json
{
  "source_bank": "chase",
  "source_file": "downloads/2026-01/chase_checking_9876_2026-01.csv",
  "source_row_number": 2,
  "date": "2026-01-10",
  "amount": -54.23,
  "account": "chase_checking_9876",
  "description": "TRADER JOE'S #123",
  "source_category": "Groceries"
}
```

`source_category` is an optional raw hint only. It MUST NOT be treated as the
final canonical category.

Then map normalized object to corpus transaction fields:

- `date` -> `date`
- `amount` -> `amount`
- `account` -> `account`
- `description` -> `description`
- resolved canonical category -> `category`
- insert/update lifecycle fields (`key`, `date_created`, `date_updated`) per
  `docs/corpus-format.md`
- optional `notes` only when the user or pipeline supplies one; otherwise omit
- after successful ingest writes, rebuild `corpus-summary.json` per
  `docs/corpus-format.md` section 9

## 7) Category resolution and validation

Category resolution MUST use an internal categorization process/tool owned by
this project; bank-provided categories are not trusted.

Required behavior:

1. Run internal categorization tool on normalized transaction data (at minimum:
   `description`, `amount`, `account`, `date`; optional `source_category` as a
   weak feature only).
2. Tool output MUST be a canonical `major:minor` category.
3. Validate tool output is in:
   - `reference/allowed-categories.json`

Legacy alignment (secondary support, non-authoritative):

- `reference/legacy-domain/category_mapping_legacy_to_canonical.tsv`
- `reference/legacy-domain/description_mapping_legacy_to_canonical.tsv`

These legacy mappings MAY be used for feature engineering, warm-start defaults,
or fallback suggestions, but MUST NOT override the internal categorization tool
without explicit policy.

Validation requirements:

- category MUST be present
- category MUST be `major:minor`
- category MUST be in allowed list

If category remains unresolved after categorization + policy fallback, ingestion
MUST assign `unknown:undefined` and emit a warning.

## 8) Ingestion pipeline (required sequence)

Ingestion MUST execute in this order:

1. Identify source type from filename (`boa`, `capone`, `chase`).
2. Parse CSV rows with bank-specific parser.
3. Normalize fields into common shape.
4. Deduplicate and locate existing candidate via deterministic identity.
5. Run internal categorization tool to produce canonical category.
6. Validate category against allowed list and apply unresolved policy.
7. Determine **insert** vs **update** decision.
8. Write to yearly JSON file (`YYYY.json`) in corpus.
9. Update `metadata` (`last_sync_date`, `sources`, `last_push_date` policy).

## 9) Insert vs update and deduplication contract

Legacy extraction found no complete corpus-level dedupe strategy, so this
contract defines one.

### 9.1 Deterministic identity key (for matching existing records)

Implementations SHOULD match existing corpus rows using:

`account + date + amount + normalized_description`

Where `normalized_description` is:

- uppercase
- whitespace collapsed
- surrounding whitespace trimmed

### 9.2 Rules

- No match -> **insert**
- One match, mutable fields changed (e.g. `category`, cleaned description) ->
  **update**
- One match, no field changes -> no-op
- Multiple matches -> fail with conflict error (manual intervention required)

This ensures idempotent re-ingestion of identical files while allowing category
improvements from the internal categorization process to flow through as
deterministic updates.

## 10) Source tracking (`.csv` -> `metadata.sources`)

For every successfully processed CSV file, write one human-readable source entry
to `metadata.sources` in the touched yearly file(s).

Required format:

`<Bank Name> import: <relative-directory>/<filename.csv>`

Examples:

- `Chase import: downloads/2026-01/chase_checking_9876_2026-01.csv`
- `Capital One import: inbox/capone_visa_4444_2026-01.csv`
- `Bank of America import: downloads/2026-01/boa_checking_1234_2026-01.csv`

Sources MUST be unique (no duplicate entries for repeated idempotent ingestion).

## 11) Legacy alignment matrix and mismatches

### 11.1 Aligned items

- Canonical category taxonomy: aligned to legacy `categories_allowed.txt`.
- Source-category mapping: aligned to legacy `xform_category.txt`.
- Description-based overrides: aligned to legacy `xform_description.txt`.
- Signed amount convention: debits negative, credits positive.

### 11.2 Known mismatches / uncertainty

1. Capital One date format:
   - legacy parser expected `%Y-%m-%d`
   - contract sample uses `%m/%d/%Y`
   - resolution: support both, normalize to ISO date
2. Chase header names:
   - legacy used `Transaction Date`
   - contract sample uses `Date`
   - resolution: accept both variants
3. BoA checking exports:
   - legacy frequently required skipping preamble rows
   - contract sample is clean tabular CSV
   - resolution: support both formats; treat tabular sample as preferred target

