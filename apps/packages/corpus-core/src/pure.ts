/**
 * Browser-safe exports (no `node:fs`). Use `@txn/corpus-core/pure` from Electron renderers.
 * Full package `@txn/corpus-core` remains for main process and tools.
 */
export { parseCategory } from './category.js'
export { monthKeyFromDate, calendarMonthFromDate, calendarYearFromDate } from './month.js'
export { parseTransactionRow } from './transaction.js'
export { parseCorpusYearFile } from './yearFile.js'
export {
  REIMBURSEMENT_CATEGORIES,
  TRANSFER_CATEGORIES,
  sectionForCategory
} from './query/partition.js'
export type { SankeySectionId } from './query/partition.js'
export {
  filterTransactionsByYearMonthRange,
  monthAvailabilityForYear,
  type MonthAvailability
} from './query/dateRange.js'
export { aggregateByCategory, type CategoryAggregate } from './query/aggregate.js'
