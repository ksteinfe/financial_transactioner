# Development

## TL;DR — Two apps, same workspace

The **`apps/`** workspace contains **multiple runnable products** under [`applications/`](../applications/). Each app is a separate **pnpm package** (`@txn/hello`, `@txn/sankey`, …) with its own **`version`**, **scripts**, and **Electron/electron-builder** output. You can **develop, build, test, and package each app independently** without touching the other product’s `package.json` or release tags.

**Run in development (from `apps/` directory, after `pnpm install`):**

| App | Command |
|-----|---------|
| **Steinfeld Finance - Hello** | `pnpm dev` **or** `pnpm --filter @txn/hello dev` |
| **Steinfeld Finance - Sankey** | `pnpm dev:sankey` **or** `pnpm --filter @txn/sankey dev` |

**Build production artifacts:**

| App | Command |
|-----|---------|
| Hello | `pnpm build` **or** `pnpm --filter @txn/hello build` |
| Sankey | `pnpm build:sankey` **or** `pnpm --filter @txn/sankey build` |

**Build local installers (no upload):**

| App | Command |
|-----|---------|
| Hello | `pnpm --filter @txn/hello package` |
| Sankey | `pnpm package:sankey` **or** `pnpm --filter @txn/sankey package` |

**Automated tests (Vitest):**

| App | Command |
|-----|---------|
| Sankey | `pnpm --filter @txn/sankey test` |

Hello does not define a workspace `test` script yet; add tests there when needed.

**Publish to GitHub Releases (tag push → CI):** see **[releases.md](releases.md)** — separate **tag prefix** and **workflow** per app.

---

## Prerequisites

- **Node.js** 20 LTS or newer (18+ may work; 20+ recommended).
- **pnpm** 9.x (see root `packageManager` in [package.json](../package.json)). If `pnpm` is not on your `PATH`, use `npx pnpm@9.15.0` in front of the commands below (or enable it via [Corepack](https://nodejs.org/api/corepack.html) if your environment allows it).

## Install

From the `apps/` directory:

```bash
pnpm install
```

## Run (development)

**Hello:**

```bash
pnpm dev
```

Equivalent:

```bash
pnpm --filter @txn/hello dev
```

This starts **Steinfeld Finance - Hello** with Electron + Vite HMR for the renderer.

**Sankey:**

```bash
pnpm dev:sankey
```

or:

```bash
pnpm --filter @txn/sankey dev
```

## Build

**Hello** — compile main, preload, and renderer:

```bash
pnpm build
```

or:

```bash
pnpm --filter @txn/hello build
```

Output is under `applications/hello/out/` (electron-vite default).

**Sankey:**

```bash
pnpm build:sankey
```

or:

```bash
pnpm --filter @txn/sankey build
```

Output under `applications/sankey/out/`.

## Package (installer / distributable)

Requires build artifacts first.

**Hello:**

```bash
pnpm --filter @txn/hello package
```

**Sankey:**

```bash
pnpm package:sankey
```

or:

```bash
pnpm --filter @txn/sankey package
```

Uses `electron-builder` from each app package. See [updates.md](updates.md) for update metadata and environment variables.

### App icons (Material Symbols)

Each packaged Electron app should ship an icon that **matches the app’s name or theme**. Source artwork from **[Google Fonts — Material Symbols & Icons](https://fonts.google.com/icons)**: pick a symbol that fits the product (for example, a greeting-style icon for “Hello” apps).

- **Size:** **512px** when exporting or downloading the PNG.
- **Color:** **`#808080`** (hex) for the symbol/fill so icons align across apps.
- **Repo layout:** store the PNG under the app package’s `build/` folder with a **short name tied to that app** (e.g. `hello.png` for Steinfeld Finance - Hello). Point `package.json` `build.icon` at that path so `electron-builder` can produce Windows `.ico` and other targets.
- **NSIS (Windows installer):** do **not** set `nsis.installerIcon` / `nsis.uninstallerIcon` to a **PNG** path — NSIS’s `makensis` only accepts **`.ico`** for those fields. Omit them and let `electron-builder` derive installer artwork from `build.icon`, or supply a real multi-size `.ico` if you customize those options.

### Windows: packaging and symbolic links

`electron-builder` downloads helper archives (for example `winCodeSign`) that extract with **symbolic links**. On some Windows setups, extraction fails with “A required privilege is not held by the client” unless symlinks are allowed. Mitigations:

- Enable **Developer Mode** (Settings → Privacy & security → For developers → Developer Mode), or
- Run the terminal **as Administrator** for the packaging command, or
- Build on CI or another machine where extraction succeeds.

`pnpm build` does not require this; only full `package` / installer flows hit the cached tooling extraction.

## Workspace packages

| Package | Role |
|---------|------|
| `@txn/hello` | Electron shell (Steinfeld Finance - Hello) |
| `@txn/sankey` | Electron app (Steinfeld Finance - Sankey flow visualization) |
| `@txn/ui-core` | Shared React primitives (canvas, month range selector) |
| `@txn/types` | Shared types |
| `@txn/app-contracts` | Manifests and capabilities |
| `@txn/corpus-core` | Corpus scan, summary index, validation |
| `@txn/category-colors` | Display colors for canonical categories ([category-colors.md](category-colors.md)) |

## Troubleshooting

- **Port in use**: Vite may default to 5173; change in `electron.vite.config` if needed.
- **Windows path length**: keep repo paths reasonably short if packaging fails.
- **Updates in dev**: expected to no-op; see [updates.md](updates.md).
