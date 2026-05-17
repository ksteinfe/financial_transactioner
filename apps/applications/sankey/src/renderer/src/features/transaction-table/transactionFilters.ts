import type { CorpusTransaction } from '@txn/types'
import type { TransactionFilterBounds } from './filterBounds.js'

export interface DateRangeFilter {
  start: string | null
  end: string | null
}

export interface AmountRangeFilter {
  min: number | null
  max: number | null
}

export interface TransactionTableFilters {
  date: DateRangeFilter
  amount: AmountRangeFilter
  /** Selected accounts; `null` means all accounts (no filter). */
  accounts: Set<string> | null
  /** Selected category paths; `null` means all categories (no filter). */
  categories: Set<string> | null
}

export const EMPTY_FILTERS: TransactionTableFilters = {
  date: { start: null, end: null },
  amount: { min: null, max: null },
  accounts: null,
  categories: null
}

export function isDateFilterActive(filters: TransactionTableFilters): boolean {
  return filters.date.start != null || filters.date.end != null
}

export function isAmountFilterActive(filters: TransactionTableFilters): boolean {
  return filters.amount.min != null || filters.amount.max != null
}

export function isAccountFilterActive(
  filters: TransactionTableFilters,
  allAccounts: readonly string[]
): boolean {
  if (filters.accounts == null) return false
  if (filters.accounts.size === 0) return true
  return filters.accounts.size < allAccounts.length
}

export function isCategoryFilterActive(
  filters: TransactionTableFilters,
  allPaths: readonly string[]
): boolean {
  if (filters.categories == null) return false
  if (filters.categories.size === 0) return true
  return filters.categories.size < allPaths.length
}

export function isColumnFilterActive(
  column: 'date' | 'amount' | 'account' | 'category',
  filters: TransactionTableFilters,
  bounds: TransactionFilterBounds
): boolean {
  switch (column) {
    case 'date':
      return isDateFilterActive(filters)
    case 'amount':
      return isAmountFilterActive(filters)
    case 'account':
      return isAccountFilterActive(filters, bounds.accounts)
    case 'category':
      return isCategoryFilterActive(filters, bounds.allCategoryPaths)
  }
}

function inDateRange(date: string, range: DateRangeFilter): boolean {
  if (range.start != null && date < range.start) return false
  if (range.end != null && date > range.end) return false
  return true
}

function inAmountRange(amount: number, range: AmountRangeFilter): boolean {
  if (range.min != null && amount < range.min) return false
  if (range.max != null && amount > range.max) return false
  return true
}

export function applyTransactionFilters(
  transactions: CorpusTransaction[],
  filters: TransactionTableFilters
): CorpusTransaction[] {
  return transactions.filter((tx) => {
    if (!inDateRange(tx.date, filters.date)) return false
    if (!inAmountRange(tx.amount, filters.amount)) return false
    if (filters.accounts != null && !filters.accounts.has(tx.account)) return false
    if (filters.categories != null && !filters.categories.has(tx.category)) return false
    return true
  })
}
