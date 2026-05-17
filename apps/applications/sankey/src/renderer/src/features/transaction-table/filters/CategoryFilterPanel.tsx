import { useMemo, useState, type ReactElement } from 'react'
import type { CategoryGroup } from '../filterBounds.js'
import { truncateDisplay } from '../truncateDisplay.js'
import { FilterPopover, FilterPopoverActions } from './FilterPopover.js'

export interface CategoryFilterPanelProps {
  groups: readonly CategoryGroup[]
  allPaths: readonly string[]
  value: Set<string> | null
  ignoreCloseWithin?: HTMLElement | null
  onApply: (selected: Set<string> | null) => void
  onClear: () => void
  onClose: () => void
}

function initialSelection(allPaths: readonly string[], value: Set<string> | null): Set<string> {
  if (value == null) return new Set(allPaths)
  return new Set(value)
}

export function CategoryFilterPanel({
  groups,
  allPaths,
  value,
  ignoreCloseWithin,
  onApply,
  onClear,
  onClose
}: CategoryFilterPanelProps): ReactElement {
  const [selected, setSelected] = useState(() => initialSelection(allPaths, value))

  const pathsInMajor = (major: string) =>
    groups.find((g) => g.major === major)?.items.map((i) => i.path) ?? []

  const isMajorChecked = (major: string) => {
    const paths = pathsInMajor(major)
    return paths.length > 0 && paths.every((p) => selected.has(p))
  }

  const isMajorIndeterminate = (major: string) => {
    const paths = pathsInMajor(major)
    const n = paths.filter((p) => selected.has(p)).length
    return n > 0 && n < paths.length
  }

  const toggleMajor = (major: string) => {
    const paths = pathsInMajor(major)
    const allOn = paths.every((p) => selected.has(p))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const p of paths) {
        if (allOn) next.delete(p)
        else next.add(p)
      }
      return next
    })
  }

  const togglePath = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const allChecked = selected.size === allPaths.length

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(allPaths))
  }

  const apply = () => {
    if (selected.size === allPaths.length) onApply(null)
    else onApply(new Set(selected))
    onClose()
  }

  const clear = () => {
    onClear()
    onClose()
  }

  const sortedGroups = useMemo(() => groups, [groups])

  return (
    <FilterPopover
      title="Filter by category"
      onClose={onClose}
      onSubmit={apply}
      ignoreCloseWithin={ignoreCloseWithin}
    >
      <div className="txn-filter-checklist txn-filter-checklist-scroll">
        <label className="txn-filter-checklist__item txn-filter-checklist__item-all">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          <span>Select all</span>
        </label>
        {sortedGroups.map((group) => (
          <div key={group.major} className="txn-filter-category-group">
            <label className="txn-filter-checklist__item txn-filter-category-major">
              <input
                type="checkbox"
                checked={isMajorChecked(group.major)}
                ref={(el) => {
                  if (el) el.indeterminate = isMajorIndeterminate(group.major)
                }}
                onChange={() => toggleMajor(group.major)}
              />
              <span>{group.major}</span>
            </label>
            {group.items.map((item) => (
              <label key={item.path} className="txn-filter-checklist__item txn-filter-category-minor">
                <input
                  type="checkbox"
                  checked={selected.has(item.path)}
                  onChange={() => togglePath(item.path)}
                />
                <span title={item.path}>{truncateDisplay(item.minor)}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <FilterPopoverActions onClear={clear} />
    </FilterPopover>
  )
}
