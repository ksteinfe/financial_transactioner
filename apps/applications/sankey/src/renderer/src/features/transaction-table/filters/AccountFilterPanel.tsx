import { useMemo, useState, type ReactElement } from 'react'
import { FilterPopover, FilterPopoverActions } from './FilterPopover.js'

export interface AccountFilterPanelProps {
  accounts: readonly string[]
  value: Set<string> | null
  ignoreCloseWithin?: HTMLElement | null
  onApply: (selected: Set<string> | null) => void
  onClear: () => void
  onClose: () => void
}

function initialSelection(accounts: readonly string[], value: Set<string> | null): Set<string> {
  if (value == null) return new Set(accounts)
  return new Set(value)
}

export function AccountFilterPanel({
  accounts,
  value,
  ignoreCloseWithin,
  onApply,
  onClear,
  onClose
}: AccountFilterPanelProps): ReactElement {
  const [selected, setSelected] = useState(() => initialSelection(accounts, value))

  const allChecked = selected.size === accounts.length

  const toggle = (account: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(account)) next.delete(account)
      else next.add(account)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(accounts))
  }

  const apply = () => {
    if (selected.size === accounts.length) onApply(null)
    else onApply(new Set(selected))
    onClose()
  }

  const clear = () => {
    onClear()
    onClose()
  }

  const sorted = useMemo(() => [...accounts].sort((a, b) => a.localeCompare(b)), [accounts])

  return (
    <FilterPopover
      title="Filter by account"
      onClose={onClose}
      onSubmit={apply}
      ignoreCloseWithin={ignoreCloseWithin}
    >
      <div className="txn-filter-checklist">
        <label className="txn-filter-checklist__item txn-filter-checklist__item-all">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          <span>Select all</span>
        </label>
        {sorted.map((account) => (
          <label key={account} className="txn-filter-checklist__item">
            <input
              type="checkbox"
              checked={selected.has(account)}
              onChange={() => toggle(account)}
            />
            <span>{account}</span>
          </label>
        ))}
      </div>
      <FilterPopoverActions onClear={clear} />
    </FilterPopover>
  )
}
