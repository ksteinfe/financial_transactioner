# Transaction Corpus Format Contract

This document defines the **strict shared contract** for the local JSON corpus
used by ingestion tools and applications in this repository.

Normative terms use RFC-style language:

- **MUST / MUST NOT** = required
- **SHOULD / SHOULD NOT** = strongly recommended
- **MAY** = optional

## 1) Scope and location

- The corpus is a **local directory on the user machine** referenced by
  `TRANSACTION_CORPUS_DIR` in `.env`.
- The corpus directory is **not part of this git repository** and MUST NOT be
  committed.
- Corpus files are partitioned by year:
  - `YYYY.json` (example: `2024.json`)
- Each yearly file MUST contain:
  - `metadata` object
  - `transactions` array

## 2) File-level schema

Each `YYYY.json` file MUST follow this shape:

```json
{
  "metadata": {
    "last_sync_date": "ISO-8601 timestamp",
    "sources": ["human-readable source entry", "..."],
    "last_push_date": "ISO-8601 timestamp"
  },
  "transactions": [
    {
      "key": "uuid",
      "date": "YYYY-MM-DD",
      "amount": -54.23,
      "account": "account_id",
      "description": "string",
      "category": "major:minor",
      "date_created": "ISO-8601 timestamp",
      "date_updated": "ISO-8601 timestamp"
    }
  ]
}
```

### 2.1 `metadata` fields

- `last_sync_date` (string, required)
  - Last successful ingest write for this yearly file.
- `sources` (array of strings, required)
  - Human-readable source labels derived from CSV filename + directory.
  - See section 6 for required format.
- `last_push_date` (string, required)
  - Last successful push/export operation touching this yearly file.
  - If no push has occurred yet, value SHOULD be set to the same timestamp as
    `last_sync_date` at file creation.

All metadata timestamps MUST be UTC ISO 8601, e.g. `2026-01-15T18:25:02Z`.

### 2.2 `transactions[]` fields

All fields are required for each transaction.

- `key` (string): stable unique identifier (UUID format recommended).
- `date` (string): transaction date in `YYYY-MM-DD`.
- `amount` (number): signed amount; debits are negative, credits are positive.
- `account` (string): normalized account identifier.
- `description` (string): normalized payee/memo text.
- `category` (string): canonical category in `major:minor` format (section 5).
- `date_created` (string): UTC ISO 8601 creation time.
- `date_updated` (string): UTC ISO 8601 last update time.

## 3) Required full sample JSON (fake values)

```json
{
  "metadata": {
    "last_sync_date": "2026-01-15T18:22:11Z",
    "sources": [
      "Bank of America import: downloads/2026-01/boa_checking_1234_2026-01.csv",
      "Chase import: downloads/2026-01/chase_checking_9876_2026-01.csv"
    ],
    "last_push_date": "2026-01-15T18:25:02Z"
  },
  "transactions": [
    {
      "key": "11111111-2222-3333-4444-555555555555",
      "date": "2026-01-10",
      "amount": -54.23,
      "account": "boa_checking_1234",
      "description": "Trader Joe's #123",
      "category": "food:groceries",
      "date_created": "2026-01-15T18:22:11Z",
      "date_updated": "2026-01-15T18:22:11Z"
    },
    {
      "key": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "date": "2026-01-09",
      "amount": 2500.0,
      "account": "chase_checking_9876",
      "description": "Payroll Deposit",
      "category": "income:misc",
      "date_created": "2026-01-15T18:22:11Z",
      "date_updated": "2026-01-15T18:23:10Z"
    }
  ]
}
```

## 4) Multi-writer contract (strict)

Multiple tools/apps MAY read/write the same corpus. Therefore all writers MUST:

1. Follow this schema exactly.
2. MUST NOT introduce ad-hoc transaction fields.
3. Preserve existing `key` values.
4. Preserve existing `date_created` on updates.
5. Update `date_updated` on every material transaction update.
6. Update `metadata.last_sync_date` on each successful ingest write.
7. Append/update `metadata.sources` entries for CSVs processed.

### 4.1 Atomic write requirement

Writers SHOULD perform write-through-temp + atomic rename to avoid partial-file
corruption during concurrent or interrupted writes.

## 5) Operation terminology (allowed terms only)

Only these operation names are valid in tooling/docs:

- **insert**: create a new transaction record
- **update**: modify an existing transaction record

### 5.1 Insert

Insert MUST:

- generate `key`
- set `date_created`
- set `date_updated` (equal to `date_created` initially)

### 5.2 Update

Update MUST:

- keep `key` unchanged
- preserve `date_created`
- set `date_updated` to current UTC ISO 8601 time

## 6) Metadata source tracking contract

`metadata.sources[]` entries MUST be:

- human-readable
- derived from CSV filename and CSV directory
- stable for idempotent re-ingestion (same input -> same source string)

Required format:

`<Bank Name> import: <relative-directory>/<filename.csv>`

Examples:

- `Bank of America import: downloads/2026-01/boa_checking_1234_2026-01.csv`
- `Capital One import: inbox/capone_visa_4444_jan2026.csv`
- `Chase import: chase/2026/chase_checking_9876_2026-01.csv`

Duplicate source strings MUST NOT be inserted twice.

## 7) Category contract (strict)

`category` is required and MUST satisfy all rules:

1. MUST match format `major:minor`.
2. MUST match regex `^[a-z_]+:[a-z0-9_]+$`.
3. MUST be a member of the allowed canonical list.

Authoritative allowed list source:

- `reference/legacy-domain/category_taxonomy.txt`
- machine-readable companion: `reference/allowed-categories.json`

Legacy mapping sources (for CSV ingestion):

- `reference/legacy-domain/category_mapping_legacy_to_canonical.tsv`
- `reference/legacy-domain/description_mapping_legacy_to_canonical.tsv`

Bank-provided CSV category labels are non-authoritative input hints only; corpus
writers MUST set `category` using the project categorization process/toolchain,
then validate membership in the allowed list.

If a category cannot be resolved by that process, writers SHOULD use
`unknown:undefined` and emit a warning for follow-up cleanup.

## 8) Behavioral rules: idempotency, dedupe, insert vs update

Legacy `tacter` logic did parsing/categorization but did not provide a formal
deduplication contract. New tooling MUST use a deterministic strategy.

Required behavior:

1. Re-ingesting the same CSV content MUST be idempotent (no duplicate inserts).
2. Candidate match identity SHOULD be deterministic and stable. Recommended
   basis: `account + date + amount + normalized_description`.
3. If no existing match is found -> **insert**.
4. If exactly one existing match is found and mutable fields differ
   (e.g., `category`, cleaned `description`) -> **update**.
5. If exactly one existing match is found and all fields are equal -> no-op.
6. If multiple matches are found, tooling MUST fail the write and surface a
   conflict for manual resolution.

## 9) Corpus and git constraints

- Corpus data is local runtime data, not repository source code.
- Corpus files MUST remain outside the repository working tree.
- `.gitignore` MUST protect against accidental local corpus commits.

## 10) Legacy alignment and known differences

Extracted legacy model (`tacter`) used short field names (`amnt`, `acnt`,
`desc`, `catg`) and parser-specific helper fields (`_catg`, `_trust_catg`,
etc.). This contract intentionally standardizes the shared corpus with explicit
names (`amount`, `account`, `description`, `category`) for multi-tool safety.
