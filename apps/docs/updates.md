# Auto-update

Updates apply to **application binaries and resources**, not the user’s corpus. Corpus migration, if ever required, is a separate, explicit workflow — never silent side effects of an app update.

## Ownership

- **Main process** owns update checks, download, and install/quit-and-restart flow.
- **Renderer** may request status or trigger a check via the preload bridge (e.g. `checkForUpdates()`), but does not implement updater logic.

## GitHub Releases (configured build)

[`apps/packages/desktop/package.json`](../packages/desktop/package.json) `build.publish` uses **`provider: "github"`** with `owner` / `repo` pointing at this repository. `electron-builder` embeds feed metadata in packaged apps; `electron-updater` reads GitHub Releases for newer versions.

**Tag-only releases** and CI are documented in [releases.md](releases.md).

## Electron behavior

Electron’s built-in `autoUpdater` (and `electron-updater` when used with `electron-builder`) follows **published metadata** on a reachable host. The app compares **published version** to **installed version**.

Official docs note: built-in auto-updater support targets **macOS and Windows**, not Linux. See [Electron: Updating Applications](https://www.electronjs.org/docs/latest/tutorial/updates).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `TXN_AUTO_UPDATE` | **Packaged builds:** updates are **enabled by default**. Set to `0`, `false`, or `no` to disable automatic checks and launch-time download. |
| `TXN_UPDATE_URL` | Optional override: **generic** provider base URL (e.g. static hosting of `latest.yml`) instead of the embedded GitHub feed — useful for testing alternate hosts. |

Development / unpackaged builds (`electron-vite dev`) **do not** check for updates; `checkForUpdates` IPC returns `skipped`.

## Runtime behavior (packaged)

1. On launch, after the window is created, the app runs **`checkForUpdates`** (failures are logged, not fatal).
2. If an update is available, it is **downloaded automatically**; when ready, a **dialog** asks to **Restart** or **Later**; **Restart** calls `quitAndInstall`.

## Release pipeline (developer)

See [releases.md](releases.md) for the **tag-only** GitHub Actions flow. Summary:

1. Bump `version` in `packages/desktop/package.json`.
2. Push tag `moneylooksee-hello-vX.Y.Z` matching that version.
3. CI publishes installers and update metadata to GitHub Releases.

## Corpus safety

An app update **must not** silently mutate corpus files. Schema or data migration is handled by dedicated tooling or an explicit editor workflow, not by the updater.
