import { useCallback, useRef, useState, type ReactElement } from 'react'
import type { CorpusTransaction } from '@txn/types'
import { IconButton } from '../../components/IconButton.js'
import { IconCopyJson, IconFilter } from '../../components/icons/index.js'
import { CategoryCell } from './CategoryCell.js'
import { DescriptionCell } from './DescriptionCell.js'
import { copyTransactionJson } from './copyTransactionJson.js'
import { AccountFilterPanel } from './filters/AccountFilterPanel.js'
import { AmountRangeFilterPanel } from './filters/AmountRangeFilterPanel.js'
import { CategoryFilterPanel } from './filters/CategoryFilterPanel.js'
import { DateRangeFilterPanel } from './filters/DateRangeFilterPanel.js'
import type { TransactionFilterBounds } from './filterBounds.js'
import { isColumnFilterActive } from './transactionFilters.js'
import type { SortableColumn, SortDirection, TransactionTableFilters } from './useTransactionTableState.js'
import type { AmountRangeFilter, DateRangeFilter } from './transactionFilters.js'

interface TransactionTableProps {
  showNotesColumn: boolean
  displayedRows: CorpusTransaction[]
  sortColumn: SortableColumn
  sortDirection: SortDirection
  filters: TransactionTableFilters
  bounds: TransactionFilterBounds
  toggleSort: (column: SortableColumn) => void
  setDateFilter: (value: DateRangeFilter) => void
  setAmountFilter: (value: AmountRangeFilter) => void
  setAccountFilter: (accounts: Set<string> | null) => void
  setCategoryFilter: (categories: Set<string> | null) => void
  clearColumnFilter: (column: SortableColumn) => void
  formatAmount: (amount: number) => string
}

function sortIndicator(active: boolean, direction: SortDirection): string {
  if (!active) return ' ↕'
  return direction === 'asc' ? ' ▲' : ' ▼'
}

export function TransactionTable({
  showNotesColumn,
  displayedRows,
  sortColumn,
  sortDirection,
  filters,
  bounds,
  toggleSort,
  setDateFilter,
  setAmountFilter,
  setAccountFilter,
  setCategoryFilter,
  clearColumnFilter,
  formatAmount
}: TransactionTableProps): ReactElement {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [openFilter, setOpenFilter] = useState<SortableColumn | null>(null)
  const anchorRefs = useRef<Partial<Record<SortableColumn, HTMLDivElement | null>>>({})

  const onCopy = useCallback(async (tx: CorpusTransaction) => {
    await copyTransactionJson(tx)
    setCopiedKey(tx.key)
    window.setTimeout(() => setCopiedKey(null), 1500)
  }, [])

  const columnHeader = (label: string, column: SortableColumn) => {
    const filterActive = isColumnFilterActive(column, filters, bounds)
    const filterOpen = openFilter === column

    return (
      <th scope="col" className="txn-col-header">
        <div
          className="txn-col-header-inner"
          ref={(el) => {
            anchorRefs.current[column] = el
          }}
        >
          <IconButton
            label={`Filter ${label}`}
            icon={<IconFilter />}
            pressed={filterActive || filterOpen}
            className="txn-col-filter-btn"
            onClick={(e) => {
              e.stopPropagation()
              setOpenFilter((prev) => (prev === column ? null : column))
            }}
          />
          <button type="button" className="txn-table-sort-btn" onClick={() => toggleSort(column)}>
            {label}
            <span className="txn-table-sort-indicator" aria-hidden>
              {sortIndicator(sortColumn === column, sortDirection)}
            </span>
          </button>
          {filterOpen ? (
            <div className="txn-col-filter-popover-anchor">
              {column === 'date' ? (
                <DateRangeFilterPanel
                  bounds={bounds.date}
                  value={filters.date}
                  ignoreCloseWithin={anchorRefs.current[column]}
                  onApply={setDateFilter}
                  onClear={() => clearColumnFilter('date')}
                  onClose={() => setOpenFilter(null)}
                />
              ) : null}
              {column === 'amount' ? (
                <AmountRangeFilterPanel
                  bounds={bounds.amount}
                  value={filters.amount}
                  formatAmount={formatAmount}
                  ignoreCloseWithin={anchorRefs.current[column]}
                  onApply={setAmountFilter}
                  onClear={() => clearColumnFilter('amount')}
                  onClose={() => setOpenFilter(null)}
                />
              ) : null}
              {column === 'account' ? (
                <AccountFilterPanel
                  accounts={bounds.accounts}
                  value={filters.accounts}
                  ignoreCloseWithin={anchorRefs.current[column]}
                  onApply={setAccountFilter}
                  onClear={() => clearColumnFilter('account')}
                  onClose={() => setOpenFilter(null)}
                />
              ) : null}
              {column === 'category' ? (
                <CategoryFilterPanel
                  groups={bounds.categoryGroups}
                  allPaths={bounds.allCategoryPaths}
                  value={filters.categories}
                  ignoreCloseWithin={anchorRefs.current[column]}
                  onApply={setCategoryFilter}
                  onClear={() => clearColumnFilter('category')}
                  onClose={() => setOpenFilter(null)}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </th>
    )
  }

  return (
    <table className="txn-transaction-table">
      <thead>
        <tr>
          {columnHeader('Date', 'date')}
          {columnHeader('Amount', 'amount')}
          {columnHeader('Account', 'account')}
          {columnHeader('Category', 'category')}
          <th scope="col">Description</th>
          {showNotesColumn ? <th scope="col">Notes</th> : null}
          <th scope="col" className="txn-table-actions-col" aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {displayedRows.length === 0 ? (
          <tr>
            <td colSpan={showNotesColumn ? 7 : 6} className="txn-table-empty">
              No transactions match the current filters.
            </td>
          </tr>
        ) : (
          displayedRows.map((tx) => (
            <tr key={tx.key}>
              <td>{tx.date}</td>
              <td className="txn-table-amount">{formatAmount(tx.amount)}</td>
              <td>{tx.account}</td>
              <CategoryCell category={tx.category} />
              <DescriptionCell text={tx.description} />
              {showNotesColumn ? <td className="txn-table-notes">{tx.notes ?? ''}</td> : null}
              <td className="txn-table-actions-cell">
                <IconButton
                  label={copiedKey === tx.key ? 'Copied JSON to clipboard' : 'Copy JSON to clipboard'}
                  icon={<IconCopyJson />}
                  className={copiedKey === tx.key ? 'txn-icon-btn-success' : undefined}
                  onClick={() => void onCopy(tx)}
                />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
