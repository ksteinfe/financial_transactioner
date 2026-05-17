import { useMemo, useState } from 'react'
import type { CorpusTransaction } from '@txn/types'
import { computeFilterBounds } from './filterBounds.js'
import {
  applyTransactionFilters,
  EMPTY_FILTERS,
  type AmountRangeFilter,
  type DateRangeFilter,
  type TransactionTableFilters
} from './transactionFilters.js'

export type SortableColumn = 'date' | 'amount' | 'account' | 'category'

export type SortDirection = 'asc' | 'desc'

export type { TransactionTableFilters, DateRangeFilter, AmountRangeFilter }

function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export function useTransactionTableState(transactions: CorpusTransaction[]) {
  const [sortColumn, setSortColumn] = useState<SortableColumn>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filters, setFilters] = useState<TransactionTableFilters>(EMPTY_FILTERS)

  const bounds = useMemo(() => computeFilterBounds(transactions), [transactions])

  const showNotesColumn = useMemo(
    () => transactions.some((tx) => tx.notes != null && tx.notes !== ''),
    [transactions]
  )

  const displayedRows = useMemo(() => {
    let rows = applyTransactionFilters(transactions, filters)

    const dir = sortDirection === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortColumn) {
        case 'date':
          cmp = a.date.localeCompare(b.date)
          break
        case 'amount':
          cmp = a.amount - b.amount
          break
        case 'account':
          cmp = a.account.localeCompare(b.account)
          break
        case 'category':
          cmp = a.category.localeCompare(b.category)
          break
      }
      if (cmp !== 0) return cmp * dir
      return a.key.localeCompare(b.key) * dir
    })
    return rows
  }, [transactions, filters, sortColumn, sortDirection])

  const toggleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const setDateFilter = (date: DateRangeFilter) => {
    setFilters((prev) => ({ ...prev, date }))
  }

  const setAmountFilter = (amount: AmountRangeFilter) => {
    setFilters((prev) => ({ ...prev, amount }))
  }

  const setAccountFilter = (accounts: Set<string> | null) => {
    setFilters((prev) => ({ ...prev, accounts }))
  }

  const setCategoryFilter = (categories: Set<string> | null) => {
    setFilters((prev) => ({ ...prev, categories }))
  }

  const clearColumnFilter = (column: SortableColumn) => {
    setFilters((prev) => {
      switch (column) {
        case 'date':
          return { ...prev, date: { start: null, end: null } }
        case 'amount':
          return { ...prev, amount: { min: null, max: null } }
        case 'account':
          return { ...prev, accounts: null }
        case 'category':
          return { ...prev, categories: null }
      }
    })
  }

  return {
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
  }
}
