# Apps workspace documentation

Layout: **[README.md](../README.md)** · **[applications/README.md](../applications/README.md)** (apps vs libraries vs packages).

| Document | Description |
|----------|-------------|
| [corpus-format.md](../../docs/corpus-format.md) (repo root) | Transaction corpus contract: `YYYY.json`, optional `corpus-summary.json`, aggregation rules |
| [architecture.md](architecture.md) | Layered model (storage → main → preload → domain → shell → visualization), reader vs editor |
| [category-colors.md](category-colors.md) | `@txn/category-colors`: theme, resolution order, major/minor explicit rules |
| [capability-model.md](capability-model.md) | `AppManifest`, `AppCapabilityProfile`, and gating of preload APIs |
| [updates.md](updates.md) | Auto-update in the main process, release hosting, environment variables |
| [releases.md](releases.md) | Tag-only GitHub Releases workflow (Steinfeld Finance - Hello) |
| [development.md](development.md) | Node/pnpm, install, dev, build, package, app icons (Material Symbols), troubleshooting |
| [CHANGELOG.md](CHANGELOG.md) | Desktop platform, releases, updater, and repo maintenance log |
