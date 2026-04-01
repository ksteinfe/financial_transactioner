# Legacy Domain Reference

This directory contains structured domain reference extracted from legacy
`tacter` code and mapping data.

It is intended for:

- preserving stable vocabulary (accounts, categories, labels),
- documenting historical category semantics,
- helping bootstrap new transaction-processing tools without reviving legacy
  implementation code.

See `legacy-domain/` for the extracted artifacts.

**Machine-readable category list:** `allowed-categories.json` is the canonical set of `major:minor` paths for corpus validation and for **`@txn/category-colors`** (see [`apps/docs/category-colors.md`](../apps/docs/category-colors.md)).
