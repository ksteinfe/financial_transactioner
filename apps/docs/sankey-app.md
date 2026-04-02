# Steinfeld Finance — Sankey app (`@txn/sankey`)

Maintainer notes: **model**, **renderer**, and **known UI issues** (pan/zoom, link visibility, data verification).

## TL;DR

- **Data path:** `buildSankeyDiagramModel` → per-section `buildSectionModel` → D3 `d3-sankey` layout in `SankeyChart.tsx`.
- **Transfer section:** No major-category column; flow is column 1 → total inflow → total outflow → outflow minors (`buildSectionModel.ts`, `skipMajors`).
- **Deficit / surplus:** Positioned under total inflow / total outflow via post-layout `adjustStackedBalances` in `SankeyChart.tsx`; fills use `--sankey-deficit` / `--sankey-surplus` (bright red/green in app CSS).
- **Open issues (2026-04):** Canvas **pan/zoom** still unreliable in the running app; **Sankey links** may not render visibly; we still need a **data↔UI verification** path (see below).

---

## What has been implemented

| Area | Location | Notes |
|------|----------|--------|
| Section graph | `applications/sankey/.../model/buildSectionModel.ts` | Strict-flow links; transfer skips majors; node order: col1, middle (TI, deficit?, TO, surplus?), majors, minors. |
| Diagram assembly | `.../model/buildSankeyDiagramModel.ts` | Partitions transactions by section; integrity checks in `graphIntegrity.ts`. |
| D3 render | `.../features/sankey-flow/SankeyChart.tsx` | `sankey()` + `sankeyLinkHorizontal()`; links as `<path>` with stroke vars; nodes as rects + labels; drag offsets via `nodeOverrides`. |
| Canvas shell | `packages/ui-core/AppCanvas.tsx` | `d3-zoom` on outer `<svg>`; `contentBounds` hit `<rect>` for pan target; `toolbarExtra` (e.g. “Reset node positions”). |
| Theme | `applications/sankey/.../styles.css`, `ui-core/styles.css` | Light scheme; canvas `--txn-canvas-bg` ~ very light grey. |
| Tests | `buildSankeyDiagramModel.test.ts`, etc. | Model tests; no E2E canvas tests yet. |

---

## Verifying node values against data

**Goal:** Confirm labels and magnitudes on screen match `SankeySectionModel` / source transactions for the selected year/month range.

**Practical approaches (not all implemented):**

1. **Renderer devtools:** In dev, log `diagram.sections` after `buildSankeyDiagramModel` in `App.tsx` (or breakpoint) and compare `nodes[].magnitude`, `formattedValue`, and `links[]` to the SVG text and tooltip content.
2. **Unit tests:** Extend `buildSankeyDiagramModel.test.ts` (or add `buildSectionModel` tests) with fixed `CorpusTransaction[]` and assert expected node/link IDs and values — **ground truth** without the visual layer.
3. **Future UI:** Optional “debug” panel or export JSON for the current diagram model would make regression checks faster than reading the canvas alone.

Integrity strings in the UI (`diagram.integrityErrors`) catch flow conservation at the **model** layer; they do not prove pixels match numbers.

---

## Links not visible — what to check next

**Implemented in code:** `<path>` elements for each laid-out link, `stroke` from `--sankey-link-stroke`, `strokeWidth` capped with a minimum, `fill="none"`, `pointerEvents="stroke"`.

**If links still do not appear in the app**, investigate in order:

1. **DOM:** DevTools → confirm `<path class="sankey-links">` exist under the canvas `<svg>` and whether `d` is non-empty.
2. **Geometry:** Zero or NaN `d` from `sankeyLinkHorizontal` if node `x0/y0/...` are invalid after layout or stacking.
3. **Paint order / clipping:** Parent `<g>` transform vs viewport; `overflow` on `.txn-app-canvas-viewport` (hidden) — ensure paths are inside the transformed region and stroke not clipped to zero height/width.
4. **Contrast:** Light grey stroke on light grey background — temporarily set `--sankey-link-stroke` to a high-contrast color to rule out visibility.
5. **Nested SVG:** Removed nested `<svg>` inside `AppCanvas` in favor of a root `<g>` for Sankey — if regressions, confirm a single `<svg>` owns zoom and children.

---

## Pan / zoom — what has been tried and what to check next

**Intent:** `d3-zoom` on the **outer** `AppCanvas` `<svg>`; wheel = zoom; drag background = pan; drag node = move node only (`stopPropagation` on node pointers).

**Already tried:**

- Transparent full-size **pan layer** `<rect>` with `pointer-events` and `contentBounds` matching chart size.
- `touch-action: none` on the zoom SVG.
- Zoom filter allowing wheel when zoom enabled; primary mouse button for pan.
- Sankey content as `<g>` (not a second `<svg>`) to avoid event/target issues.

**If pan/zoom still fail:**

1. Confirm **wheel** reaches the `svg` (listener on `svg` via `select(svg).call(z)`): no parent `preventDefault` or passive wheel handler stealing events.
2. **Electron / Chromium:** Test `about:blank` or a minimal page with the same `AppCanvas` in isolation; compare with browser DevTools “Issues” for scroll/wheel.
3. **Hit order:** Ensure the pan `rect` is **behind** chart content but receives events in **empty** areas; chart root uses a non-capturing transparent `rect` where appropriate so empty space falls through to the pan layer.
4. **React 19 / strict mode:** Double `useEffect` attach/detach of zoom — verify `cleanup` runs and only one zoom behavior is active.

---

## Related docs

- [development.md](development.md) — `pnpm dev:sankey`, test, build commands.
- [CHANGELOG.md](CHANGELOG.md) — Sankey entries and unreleased notes.
- [applications/sankey/README.md](../applications/sankey/README.md) — package overview.
