# `@txn/ui-core`

Shared **React** primitives for Steinfeld Finance desktop apps: pan/zoom SVG canvas, year/month range controls, and global styles — **not** chart libraries (those stay per app: D3, ECharts, etc.).

## Exports

- **`AppCanvas`** — SVG host with d3-zoom pan/zoom, fit-to-content, reset view, optional `contentBounds`, `onTransformChange`.
- **`YearMonthRangeSelector`** — year dropdown + 12 month buttons, inclusive range (click anchor then end month), faded months when `hasData` is false.

## Styles

Import bundled CSS once in the app shell:

```ts
import '@txn/ui-core/styles.css'
```

## Consumption

- **`@txn/sankey`** — primary consumer for Sankey layout chrome.
- Other apps may depend on `workspace:*` and add `build:deps` steps as needed.
