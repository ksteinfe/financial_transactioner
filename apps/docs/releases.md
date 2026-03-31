# Tag-only GitHub Releases

## TL;DR

1. Bump **`version`** in the app’s `package.json` (see table below) and **commit** on `main`.
2. Create and push a tag whose suffix **exactly matches** `version` (replace `X.X.X` with that semver, e.g. `0.2.0`):

   ```bash
   git tag steinfeld-finance-hello-vX.X.X
   git push origin steinfeld-finance-hello-vX.X.X
   ```

3. CI builds and publishes that app to **GitHub Releases**.

**Fresh repo:** If you cleared old tags and releases, you’re starting clean. From now on only use the **new** tag prefixes (not `moneylooksee-hello-*`). Old tags like `moneylooksee-hello-v0.1.0` were retired in favor of app-specific slugs such as **`steinfeld-finance-hello-v*`** for **Steinfeld Finance - Hello**.

| App (product) | Package / workflow | Tag prefix (examples) |
|---------------|--------------------|------------------------|
| **Steinfeld Finance - Hello** | [`apps/packages/desktop/package.json`](../packages/desktop/package.json) · [`.github/workflows/release-steinfeld-finance-hello.yml`](../../.github/workflows/release-steinfeld-finance-hello.yml) | `steinfeld-finance-hello-v` + version → e.g. `steinfeld-finance-hello-v0.1.0`, `steinfeld-finance-hello-v1.0.0` |
| *(future Electron app)* | Add another workflow + bump that app’s `package.json` | e.g. `my-other-app-v` + version → `my-other-app-v0.1.0` |

Each app gets its **own tag namespace** so installers and `latest.yml` never collide.

---

## Prerequisites

- [`build.publish`](../packages/desktop/package.json) in the desktop `package.json` uses `provider: "github"` with `owner` / `repo` for this repository.
- You can push to the repo and create tags (Actions will run on tag push).

## Release steps (Steinfeld Finance - Hello)

1. **Version** — Edit [`apps/packages/desktop/package.json`](../packages/desktop/package.json) and set `"version"` to the new semver (e.g. `"0.2.0"`). Commit and push to `main` (or merge via PR).

2. **Tag** — Prefix is **`steinfeld-finance-hello-v`** (no extra `v` inside the semver). The full tag must be `steinfeld-finance-hello-v` + **exactly** the same string as `version`.

   ```bash
   # Example: package.json has "version": "0.2.0"
   git tag steinfeld-finance-hello-v0.2.0
   git push origin steinfeld-finance-hello-v0.2.0
   ```

3. **CI** — [`.github/workflows/release-steinfeld-finance-hello.yml`](../../.github/workflows/release-steinfeld-finance-hello.yml) runs on `steinfeld-finance-hello-v*`. It compares the tag to `package.json` and **fails** if they don’t match. On success it builds on Windows and runs `pnpm --filter @txn/desktop run release`, uploading the installer and update metadata to the **Release** for that tag (`GITHUB_TOKEN`).

4. **Optional** — Add release notes on the GitHub Release page.

## Naming note (old vs new tags)

Earlier drafts used tags like **`moneylooksee-hello-v*`** for this app. That prefix is **no longer used**. Current convention is the **slug** in the table above (`steinfeld-finance-hello-v*`). If you wiped GitHub tags/releases for a clean slate, only create tags under the new names going forward.

## What users get

Packaged apps check for updates on launch ([updates.md](updates.md)). A newer Release on GitHub triggers download + restart prompt when ready.

## Verify before you rely on CI

1. **Local build, no upload:** from `apps/`, run `pnpm --filter @txn/desktop package` — artifacts land under `packages/desktop/release/`.
2. **First real release:** after pushing a new tag, open the workflow run and the GitHub Release; confirm assets (installer, `latest.yml`, etc.) attached.
3. **Updater:** install an older build, publish a higher version via a new tag, launch the old app — confirm it offers an update.

## Adding another Electron app later

1. New workflow file listening on a **new** tag pattern, e.g. `other-product-v*`.
2. That app’s own `package.json` `version` and `build.publish` (or scoped publish config).
3. Document the new row in the **TL;DR** table and keep tag prefixes unique per app.
