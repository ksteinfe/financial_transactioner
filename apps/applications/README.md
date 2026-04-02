# Applications (`applications/`)

## TL;DR

Each **subfolder** is one **deployable product** (`@txn/<folder>`): its own **version**, **Electron build**, and **release tag prefix**. Develop and test with `pnpm --filter @txn/<folder> dev` from `apps/` (see [development.md](../docs/development.md)). Publish with a **product-specific git tag** and CI (see [releases.md](../docs/releases.md)). **Hello** and **Sankey** do not share release tags or installers.

**Commands (from `apps/`):**

| Product | Dev | Test | Package (local installer) |
|---------|-----|------|---------------------------|
| Hello | `pnpm dev` or `pnpm --filter @txn/hello dev` | *(no workspace test script yet)* | `pnpm --filter @txn/hello package` |
| Sankey | `pnpm dev:sankey` or `pnpm --filter @txn/sankey dev` | `pnpm --filter @txn/sankey test` | `pnpm --filter @txn/sankey package` |

---

Each **subfolder** is one **deployable product**: something with its own `package.json`, scripts, and (usually) a distinct npm name.

## Current and example layout

```
applications/
  hello/           # @txn/hello — Steinfeld Finance - Hello (Electron)
  sankey/          # @txn/sankey — Steinfeld Finance - Sankey (Electron)
  second/          # (future) @txn/second — placeholder name for another product
```

Folder **`second`** is not in the repo yet; it illustrates how another product could be added.

## Naming conventions

- **Directory name** — Short, **kebab-case** if multi-word (`hello`, `sankey`, `budget-planner`). This is the stable slug for paths and often matches the npm package suffix.
- **Package name** — **`@txn/<directory>`** when the app is part of this monorepo (e.g. `@txn/hello`, `@txn/sankey`). Keeps `pnpm --filter` predictable.
- **Product vs package** — User-visible titles (`productName`, installers) can differ from the folder name (e.g. folder `hello`, product **Steinfeld Finance - Hello**).

## Adding a new application

1. Create **`applications/<slug>/`** with a `package.json` (`name`: `@txn/<slug>`, `private`: true unless publishing to npm).
2. Ensure **`pnpm-workspace.yaml`** includes `applications/*` (already true for this repo).
3. Add **root scripts** in `apps/package.json` if you want a shortcut (e.g. `"dev:sankey": "pnpm --filter @txn/sankey dev"`), or call `pnpm --filter @txn/<slug> <script>` directly.
4. For **Electron releases**, add a **dedicated GitHub Actions workflow** and a **unique tag prefix** per app (see [docs/releases.md](../docs/releases.md)) so installers and update metadata never collide.

## Shared code

- Put **IPC contracts, manifests, shared types** in **`libraries/`** (`@txn/types`, `@txn/app-contracts`).
- Put **domain logic** reused by multiple apps in **`packages/`** (`@txn/corpus-core`, `@txn/category-colors`, …). Category display colors: [category-colors.md](../docs/category-colors.md).
- Keep **app-specific UI and wiring** inside **`applications/<slug>/`**.
