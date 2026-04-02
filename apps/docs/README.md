# Apps workspace documentation

## TL;DR

- **Layout:** [README.md](../README.md) · [applications/README.md](../applications/README.md) (apps vs libraries vs packages).
- **Develop / test locally:** [development.md](development.md) — commands for `pnpm dev`, `pnpm dev:sankey`, `pnpm --filter @txn/sankey test`, build, package.
- **Ship to GitHub Releases:** [releases.md](releases.md) — per-app `version` bump, `git tag` + `git push` with the correct **tag prefix** (Hello vs Sankey), CI uploads installers.

---

| Document | Description |
|----------|-------------|
| [corpus-format.md](../../docs/corpus-format.md) (repo root) | Transaction corpus contract: `YYYY.json`, optional `corpus-summary.json`, aggregation rules |
| [architecture.md](architecture.md) | Layered model (storage → main → preload → domain → shell → visualization), reader vs editor |
| [category-colors.md](category-colors.md) | `@txn/category-colors`: theme, resolution order, major/minor explicit rules |
| [capability-model.md](capability-model.md) | `AppManifest`, `AppCapabilityProfile`, and gating of preload APIs |
| [updates.md](updates.md) | Auto-update in the main process, release hosting, environment variables |
| [releases.md](releases.md) | Tag-only GitHub Releases — **TL;DR** for Hello + Sankey, tag commands, workflows |
| [development.md](development.md) | **TL;DR** for two apps — install, run, build, test, package, icons, troubleshooting |
| [CHANGELOG.md](CHANGELOG.md) | Desktop platform, releases, updater, and repo maintenance log |
| [sankey-app.md](sankey-app.md) | **Sankey app:** what shipped, pan/zoom & link visibility notes, verifying data vs UI |
