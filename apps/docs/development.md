# Development

## Prerequisites

- **Node.js** 20 LTS or newer (18+ may work; 20+ recommended).
- **pnpm** 9.x (see root `packageManager` in [package.json](../package.json)). If `pnpm` is not on your `PATH`, use `npx pnpm@9.15.0` in front of the commands below (or enable it via [Corepack](https://nodejs.org/api/corepack.html) if your environment allows it).

## Install

From the `apps/` directory:

```bash
pnpm install
```

## Run (development)

```bash
pnpm dev
```

Equivalent:

```bash
pnpm --filter @txn/hello dev
```

This starts the Electron app with Vite HMR for the renderer.

## Build

Compile main, preload, and renderer:

```bash
pnpm build
```

or:

```bash
pnpm --filter @txn/hello build
```

Output is under `applications/hello/out/` (electron-vite default).

## Package (installer / distributable)

Requires build artifacts first:

```bash
pnpm --filter @txn/hello package
```

Uses `electron-builder` from the hello app package. See [updates.md](updates.md) for update metadata and environment variables.

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
| `@txn/types` | Shared types |
| `@txn/app-contracts` | Manifests and capabilities |
| `@txn/corpus-core` | Corpus scan, summary index, validation |
| `@txn/category-colors` | Display colors for canonical categories ([category-colors.md](category-colors.md)) |

## Troubleshooting

- **Port in use**: Vite may default to 5173; change in `electron.vite.config` if needed.
- **Windows path length**: keep repo paths reasonably short if packaging fails.
- **Updates in dev**: expected to no-op; see [updates.md](updates.md).
