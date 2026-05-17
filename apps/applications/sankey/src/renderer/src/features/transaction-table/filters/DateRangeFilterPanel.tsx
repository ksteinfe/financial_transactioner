import { useState, type ReactElement } from 'react'
import type { DateBounds } from '../filterBounds.js'
import type { DateRangeFilter } from '../transactionFilters.js'
import { FilterPopover, FilterPopoverActions } from './FilterPopover.js'

export interface DateRangeFilterPanelProps {
  bounds: DateBounds
  value: DateRangeFilter
  ignoreCloseWithin?: HTMLElement | null
  onApply: (value: DateRangeFilter) => void
  onClear: () => void
  onClose: () => void
}

export function DateRangeFilterPanel({
  bounds,
  value,
  ignoreCloseWithin,
  onApply,
  onClear,
  onClose
}: DateRangeFilterPanelProps): ReactElement {
  const [start, setStart] = useState(value.start ?? '')
  const [end, setEnd] = useState(value.end ?? '')

  const apply = () => {
    onApply({
      start: start.trim() || null,
      end: end.trim() || null
    })
    onClose()
  }

  const clear = () => {
    setStart('')
    setEnd('')
    onClear()
    onClose()
  }

  return (
    <FilterPopover
      title="Filter by date"
      onClose={onClose}
      onSubmit={apply}
      ignoreCloseWithin={ignoreCloseWithin}
    >
      <div className="txn-filter-popover__fields">
        <label className="txn-filter-field">
          <span>Start</span>
          <input
            type="date"
            min={bounds.min}
            max={bounds.max}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="txn-filter-field">
          <span>End</span>
          <input
            type="date"
            min={bounds.min}
            max={bounds.max}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <p className="txn-filter-hint">
          Range: {bounds.min} — {bounds.max}
        </p>
      </div>
      <FilterPopoverActions onClear={clear} />
    </FilterPopover>
  )
}
