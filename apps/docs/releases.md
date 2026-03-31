# Tag-only releases (moneylooksee - hello)

Desktop builds are published to **GitHub Releases** in this repository using **Pattern 1**: **one tag namespace per app**. The **moneylooksee - hello** app uses tags `moneylooksee-hello-vX.Y.Z`.

## Prerequisites

- [`package.json` publish config](../packages/desktop/package.json) `build.publish` uses `provider: "github"` with `owner` / `repo` matching this GitHub repository (`ksteinfe` / `financial_transactioner`).
- You have push access to the repo and permission to create tags and run Actions.

## Release steps (maintainer)

1. **Bump the version** in [`apps/packages/desktop/package.json`](../packages/desktop/package.json) (`version` field). Commit the change to your main branch (or merge via PR).

2. **Create and push a tag** whose suffix **exactly matches** `version` (semver, no `v` inside the version string):

   ```bash
   # Example: package.json version is 0.2.0
   git tag moneylooksee-hello-v0.2.0
   git push origin moneylooksee-hello-v0.2.0
   ```

   The CI workflow [`.github/workflows/release-moneylooksee-hello.yml`](../../.github/workflows/release-moneylooksee-hello.yml) runs only on pushes to tags matching `moneylooksee-hello-v*`. It **fails** if the tag suffix does not equal `packages/desktop/package.json` `version`.

3. **GitHub Actions** builds on `windows-latest`, runs `pnpm install` under `apps/`, then `pnpm --filter @txn/desktop run release`, which uploads the installer and update metadata (e.g. `latest.yml`) to a **Release** for that tag. Uses `GITHUB_TOKEN` (no PAT in the repo).

4. **Notify users** via changelog in the GitHub Release description if you want release notes.

## What end users see

Packaged apps **check for updates on launch** (see [updates.md](updates.md)). If a newer version exists on GitHub Releases, the app downloads it and prompts to restart. Failures (offline, API errors) are logged and do not block startup.

## Verification (before trusting a pipeline)

1. **Local dry run (no upload):** from `apps/`, run `pnpm --filter @txn/desktop package` — produces artifacts under `packages/desktop/release/` without publishing.

2. **CI:** Push a tag on a **fork** or use a **prerelease** tag pattern in a test branch workflow copy to confirm the job goes green and assets appear on the Release.

3. **Updater:** Install an older packaged build, publish a newer tag via CI, launch the old build — confirm update is offered (or use `checkForUpdates` from DevTools / future UI).

## Future apps

Add a **separate workflow** and **tag prefix** per Electron app (e.g. `moneylooksee-other-v*`) so `latest.yml` and installers do not collide on the same release tag.
