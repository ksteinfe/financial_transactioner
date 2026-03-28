# Legacy transaction schema reference (extracted)

This is a cleaned extraction of transaction fields observed in the retired
`tacter` pipeline. It is intended as a vocabulary/semantics reference only.

## Normalized fields

- `date`
  - Parsed transaction date.
  - Legacy parser accepted several input date formats per institution.
- `amnt`
  - Signed numeric amount.
  - Legacy convention generally used negative values for debits/expenses.
- `acnt`
  - Normalized account identifier (see `accounts.json`).
- `desc`
  - Human-readable transaction description or payee text.
- `catg`
  - Canonical category label when resolved by rules.

## Legacy source/auxiliary fields

- `_catg`
  - Source-provided category label from exported CSV when present.
- `_trust_catg`
  - Boolean trust hint used by legacy categorization logic.
  - `True` meant source category was treated as authoritative enough to map.
- `_desc`
  - Source "description" field retained for some imported records.
- `_labl`
  - Source labels/tags field retained for some imports.
- `_note`
  - Source notes/comment field retained for some imports.
- `pred`
  - ML-predicted category label (legacy optional inference stage).
- `prob`
  - Scalar confidence for predicted category (legacy optional inference stage).

## Legacy institution/account detection clues (heuristic)

The old parser used CSV header strings and filename substrings to infer account
type. This behavior was fragile and is captured here as historical context:

- Header prefix `transaction date,posted date` -> Capital One
- Header prefix `transaction date,post date` -> Chase
- Header prefix `"date","description"` -> Mint historical export
- Header prefix `posted date,reference number` + filename containing:
  - `visa` -> Bank of America Visa
  - `alsk` or `alaska` -> Alaska card account
- Header prefix `description,,summary` + filename containing:
  - `2955` -> primary checking
  - `2232` -> bills checking

Interpret these as historical hints, not contracts for future tools.
