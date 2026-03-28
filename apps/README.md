# Apps Workspace

This directory is reserved for end-user applications over the local transaction
corpus.

Configuration for all apps is centralized in repository-root `.env` (copy from
`.env.example`).

Expected near-term focus:

- JavaScript/Electron applications for:
  - timeline and category visualization,
  - data quality and maintenance workflows,
  - transaction annotation/review.

Keep application code here and reference shared corpus semantics from:

- `reference/legacy-domain/`
