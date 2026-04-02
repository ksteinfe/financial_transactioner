# Tag-only GitHub Releases

## TL;DR — Publishing to GitHub Releases

The repo ships **two separate Electron apps** (Hello and Sankey). Each has its own **`package.json` `version`**, **git tag prefix**, and **GitHub Actions workflow**. Pushing a tag runs **only that app’s** build and uploads **only that app’s** installer and update metadata — **tags and Releases do not mix between products**.

### Steinfeld Finance - Hello

1. Bump **`version`** in [`apps/applications/hello/package.json`](../applications/hello/package.json) and commit to `main`.
2. Create a tag: **`steinfeld-finance-hello-v`** + exact semver (no extra `v` inside the version).

   ```bash
   git tag steinfeld-finance-hello-vX.X.X
   git push origin steinfeld-finance-hello-vX.X.X
   ```

3. CI ([`release-steinfeld-finance-hello.yml`](../../.github/workflows/release-steinfeld-finance-hello.yml)) builds and publishes to **GitHub Releases** for that tag.

### Steinfeld Finance - Sankey

1. Bump **`version`** in [`apps/applications/sankey/package.json`](../applications/sankey/package.json) and commit to `main`.
2. Create a tag: **`steinfeld-finance-sankey-v`** + exact semver.

   ```bash
   git tag steinfeld-finance-sankey-vX.X.X
   git push origin steinfeld-finance-sankey-vX.X.X
   ```

3. CI ([`release-steinfeld-finance-sankey.yml`](../../.github/workflows/release-steinfeld-finance-sankey.yml)) builds and publishes to **GitHub Releases** for that tag.

**Rules:** Tag suffix must **match** the corresponding `package.json` `version` string exactly. Use **separate commits** if you release both apps in one day (two versions, two tags). See [Verify before you rely on CI](#verify-before-you-rely-on-ci) for local dry runs.

**Fresh repo:** Use only the **new** tag prefixes (not `moneylooksee-hello-*`). Old tags like `moneylooksee-hello-v0.1.0` were retired in favor of **`steinfeld-finance-hello-v*`**.

| App (product) | `package.json` | Workflow | Tag pattern (example for `0.2.0`) |
|---------------|----------------|----------|-----------------------------------|
| **Steinfeld Finance - Hello** | [`applications/hello`](../applications/hello/package.json) | [`release-steinfeld-finance-hello.yml`](../../.github/workflows/release-steinfeld-finance-hello.yml) | `steinfeld-finance-hello-v0.2.0` |
| **Steinfeld Finance - Sankey** | [`applications/sankey`](../applications/sankey/package.json) | [`release-steinfeld-finance-sankey.yml`](../../.github/workflows/release-steinfeld-finance-sankey.yml) | `steinfeld-finance-sankey-v0.2.0` |

Each app gets its **own tag namespace** so installers and `latest.yml` never collide.

A running narrative of packaging, updater, and history work is in [CHANGELOG.md](CHANGELOG.md).

---

## Prerequisites

- Each app’s [`build.publish`](../applications/hello/package.json) uses `provider: "github"` with `owner` / `repo` for this repository (same repo for both apps; different tags and Release assets).
- You can push to the repo and create tags (Actions run on tag push).

## Release steps (Steinfeld Finance - Hello)

1. **Version** — Edit [`apps/applications/hello/package.json`](../applications/hello/package.json) and set `"version"` to the new semver (e.g. `"0.2.0"`). Commit and push to `main` (or merge via PR).

2. **Tag** — Prefix is **`steinfeld-finance-hello-v`** (no extra `v` inside the semver). The full tag must be `steinfeld-finance-hello-v` + **exactly** the same string as `version`.

   ```bash
   # Example: package.json has "version": "0.2.0"
   git tag steinfeld-finance-hello-v0.2.0
   git push origin steinfeld-finance-hello-v0.2.0
   ```

3. **CI** — [`.github/workflows/release-steinfeld-finance-hello.yml`](../../.github/workflows/release-steinfeld-finance-hello.yml) runs on `steinfeld-finance-hello-v*`. It compares the tag to `applications/hello/package.json` and **fails** if they don’t match. On success it builds on Windows and runs `pnpm --filter @txn/hello run release`, uploading the installer and update metadata to the **Release** for that tag (`GITHUB_TOKEN`).

4. **Optional** — Add release notes on the GitHub Release page.

## Release steps (Steinfeld Finance - Sankey)

1. **Version** — Edit [`apps/applications/sankey/package.json`](../applications/sankey/package.json) and set `"version"` to the new semver (e.g. `"0.2.0"`). Commit and push to `main` (or merge via PR).

2. **Tag** — Prefix is **`steinfeld-finance-sankey-v`**. The full tag must match **`version`** exactly after the prefix.

   ```bash
   # Example: package.json has "version": "0.2.0"
   git tag steinfeld-finance-sankey-v0.2.0
   git push origin steinfeld-finance-sankey-v0.2.0
   ```

3. **CI** — [`.github/workflows/release-steinfeld-finance-sankey.yml`](../../.github/workflows/release-steinfeld-finance-sankey.yml) runs on `steinfeld-finance-sankey-v*`. It compares the tag to `applications/sankey/package.json` and **fails** if they don’t match. On success it builds and runs `pnpm --filter @txn/sankey run release`, uploading assets to that tag’s Release.

4. **Optional** — Add release notes on the GitHub Release page.

## Naming note (old vs new tags)

Earlier drafts used tags like **`moneylooksee-hello-v*`** for Hello. That prefix is **no longer used**. Current convention is the **slug** in the table above (`steinfeld-finance-hello-v*`, `steinfeld-finance-sankey-v*`). If you wiped GitHub tags/releases for a clean slate, only create tags under the new names going forward.

## What users get

Packaged apps check for updates on launch ([updates.md](updates.md)). A newer **Release for that same app** (matching tag prefix / product) triggers download + restart when ready.

## Verify before you rely on CI

From the **`apps/`** directory, after `pnpm install`:

**Hello — local installer, no upload:**

```bash
pnpm --filter @txn/hello package
```

Artifacts under `applications/hello/release/`.

**Sankey — local installer, no upload:**

```bash
pnpm --filter @txn/sankey package
```

Artifacts under `applications/sankey/release/`.

**After first real tag push:** open the workflow run and the GitHub Release; confirm assets (installer, `latest.yml`, etc.) attached.

**Updater:** install an older build of **that app**, publish a higher **version** via a **new tag for that app**, launch the old build — confirm it offers an update.

## Adding another Electron app later

1. Add the app under **`applications/<slug>/`** (for example `applications/second/`) with its own `package.json` (`@txn/<slug>`).
2. New workflow file listening on a **new** tag pattern — **must not** reuse another app’s prefix (Hello: `steinfeld-finance-hello-v*`; Sankey: `steinfeld-finance-sankey-v*`).
3. That app’s own `package.json` `version` and `build.publish` (or scoped publish config).
4. Document the new row in the **TL;DR** table and keep tag prefixes unique per app.
