import { useMemo, type ReactElement } from 'react'
import {
  getColorForCategory,
  getColorForMajor,
  listAllowedCategories,
  parseCategoryPath
} from '@txn/category-colors'

export interface CategoryGroup {
  major: string
  majorHex: string
  items: { path: string; minor: string; hex: string }[]
}

function buildCategoryGroups(): CategoryGroup[] {
  const paths = [...listAllowedCategories()].sort()
  const map = new Map<string, { path: string; minor: string; hex: string }[]>()
  for (const path of paths) {
    const { major, minor } = parseCategoryPath(path)
    const { hex } = getColorForCategory(path)
    if (!map.has(major)) map.set(major, [])
    map.get(major)!.push({ path, minor, hex })
  }
  for (const items of map.values()) {
    items.sort((a, b) => a.minor.localeCompare(b.minor))
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([major, items]) => ({
      major,
      majorHex: getColorForMajor(major).hex,
      items
    }))
}

export function CategoryColorsPanel(): ReactElement {
  const groups = useMemo(() => buildCategoryGroups(), [])

  return (
    <section className="category-palette" aria-labelledby="category-palette-heading">
      <h2 id="category-palette-heading" className="table-title category-palette-title">
        Category colors
      </h2>
      <p className="muted small category-palette-lede">
        Major seed color (LAB clipped) sits next to each major name; each line is one minor with its own
        color. From <code>@txn/category-colors</code>.
      </p>

      <div className="category-palette-scroll">
        {groups.map(({ major, majorHex, items }) => (
          <div key={major} className="category-major-block">
            <h3 className="category-major-name">
              <span
                className="category-swatch category-swatch-major-heading"
                style={{ backgroundColor: majorHex }}
                title={`Major ${major} (seed, clipped)`}
                aria-hidden
              />
              <span>{major}</span>
            </h3>
            <ul className="category-list" role="list">
              {items.map(({ path, minor, hex }) => (
                <li
                  key={path}
                  className="category-row"
                  title={path}
                  aria-label={`${minor}: ${path}`}
                >
                  <span
                    className="category-swatch category-swatch-minor-line"
                    style={{ backgroundColor: hex }}
                    title={path}
                    aria-hidden
                  />
                  <span className="category-minor">{minor}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
