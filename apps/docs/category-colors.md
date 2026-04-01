# Category colors (`@txn/category-colors`)

**Layer 3** — deterministic display colors for canonical **`major:minor`** category strings. Used by Steinfeld Finance - Hello (Category colors panel) and any future app that charts or lists transactions by category.

The package does **not** read the corpus; it maps strings to hex using a **theme** and the same allowed-category list as the corpus contract.

## Location in the repo

| Item | Path |
|------|------|
| Package | [`packages/category-colors/`](../packages/category-colors/) |
| Default theme | [`packages/category-colors/src/category-color-theme.json`](../packages/category-colors/src/category-color-theme.json) |
| Allowed paths (source of truth for minors per major) | [`reference/allowed-categories.json`](../../reference/allowed-categories.json) |

Workspace layout: shared domain modules live under **`apps/packages/`**; runnable apps under **`apps/applications/`**; types and IPC contracts under **`apps/libraries/`** — see [apps/README.md](../README.md).

## Inputs

1. **`CategoryColorTheme`** — usually `loadDefaultTheme()` from bundled JSON; optional custom theme for tests or alternate palettes.
2. **Allowed list** — defaults to `reference/allowed-categories.json`; optional override for unit tests.

## Public API (summary)

| Export | Role |
|--------|------|
| `getColorForCategory(path)` | Full path `food:groceries` or major-only `food` (no `:`) → `{ hex }`. |
| `getColorForMajor(major)` | Color for a major id; uses explicit major entry or `majors` seed. |
| `parseCategoryPath` | Split `major:minor`; malformed input aligns with corpus-core conventions. |
| `listAllowedCategories` | Iterable list of canonical paths (for UIs that enumerate rows). |
| `loadDefaultTheme` | Parsed default `CategoryColorTheme`. |

Hex values are normalized to **`#rrggbb`**.

## How resolution works

Resolution order for a **full** path `major:minor`:

1. **`explicit["major:minor"]`** — if set, that color wins (hex string or `{ hex }` / `{ lab }`). Per-path overrides are strongest.
2. **`explicit["major"]`** — if set (major-only key), **every** minor under that major uses this color directly (no per-minor LAB grid). Lets you pin one color for a whole family (for example default theme uses `"unknown": "#ff00ff"` for all `unknown:*` minors).
3. **Generated colors** — otherwise the resolver builds a **LAB axis-aligned region** from the major’s entry in `majors` (seed hex → box with half-extents, intersected with optional `labBounds`), then places each **non-explicit** minor on a deterministic **L* sweep + a*/b* grid** inside that box. Non-canonical paths fall back to a **hash** placement in the region.

**Major-only lookups** (`getColorForMajor` / `getColorForCategory` without `:`):

- If **`explicit[major]`** exists → that hex.
- Else **`majors[major]`** seed → LAB → clamp to **`labBounds`** → hex (same clipping idea as the base of generated minors).

**Explicit colors:** plain hex strings pass through (normalized). `{ lab }` encodes to sRGB hex without `labBounds` clipping. If both `hex` and `lab` are set in an object, **hex wins**.

## Theme file shape (`category-color-theme.json`)

- **`labBounds`** — global CIELAB box; generated and major-seed paths clamp L\*, a\*, b\* here before converting to hex.
- **`majors`** — map **major id → seed hex** (or advanced `MajorTheme` with custom `region` / `centerHex` / half-extents). Drives the LAB region for grid placement and default major color when no major-level explicit exists.
- **`explicit`** — optional overrides: full paths and/or **major-only** keys, as described above.
- **`_notes`** — human-readable help for editors; ignored by the resolver.

## UI in Steinfeld Finance - Hello

The renderer includes a **Category colors** section ([`CategoryColorsPanel`](../applications/hello/src/renderer/src/CategoryColorsPanel.tsx)): for each major, a **swatch** next to the major name and **one swatch per line** next to each minor label, using `getColorForMajor` / `getColorForCategory`.

## Tests

From `apps/`:

```bash
pnpm --filter @txn/category-colors test
```

Validation tests ensure explicit keys are either full paths present in `allowed-categories.json` or a **major id** that appears in that list.
