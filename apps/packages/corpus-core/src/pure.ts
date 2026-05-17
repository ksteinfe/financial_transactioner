/**
 * Browser-safe exports (no `node:fs`). Use `@txn/corpus-core/pure` from Electron renderers.
 * Full package `@txn/corpus-core` remains for main process and tools.
 */
export { parseCategory } from './category.js'
export { monthKeyFromDate, calendarMonthFromDate, calendarYearFromDate } from './month.js'
export { parseTransactionRow } from './transaction.js'
export { parseCorpusYearFile } from './yearFile.js'
export {
  isReimbursementCategory,
  isTransferCategory,
  sectionForCategory
} from './query/partition.js'
export type { SankeySectionId } from './query/partition.js'
export {
  filterTransactionsByYearMonthRange,
  monthAvailabilityForYear,
  resolveSelectedMonths,
  type MonthAvailability,
  type YearMonthSelection
} from './query/dateRange.js'
export {
  aggregateByCategory,
  aggregateByCategorySplitSign,
  type CategoryAggregate,
  type CategorySignSplit
} from './query/aggregate.js'
