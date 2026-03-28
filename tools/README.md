# tools/

Workspace for transaction ingestion and transformation tooling.

Planned scope:

- importers for bank/card exports (CSV, OFX, QFX, etc.)
- normalization to an internal transaction schema
- deterministic rule-based enrichment and reconciliation
- write/update operations against a local JSON corpus (ignored by git)
- validation and consistency tooling

Initial expectation:

- tools should read from user-provided exports and write to local corpus paths
- corpus paths must remain outside version control (see repository `.gitignore`)
