import type { CorpusTransaction } from '@txn/types'
import { calendarMonthFromDate, calendarYearFromDate } from '../month.js'

export interface MonthAvailability {
  month: number
  hasData: boolean
}

/**
 * Keep transactions whose date falls in `year` and in [startMonth, endMonth] inclusive.
 */
export function filterTransactionsByYearMonthRange(
  transactions: CorpusTransaction[],
  year: number,
  startMonth: number,
  endMonth: number
): CorpusTransaction[] {
  const lo = Math.min(startMonth, endMonth)
  const hi = Math.max(startMonth, endMonth)
  const out: CorpusTransaction[] = []
  for (const tx of transactions) {
    const y = calendarYearFromDate(tx.date)
    const m = calendarMonthFromDate(tx.date)
    if (y === null || m === null) continue
    if (y !== year) continue
    if (m < lo || m > hi) continue
    out.push(tx)
  }
  return out
}

/**
 * For a given calendar year, whether each month 1..12 has at least one transaction (any day).
 */
export function monthAvailabilityForYear(
  transactions: CorpusTransaction[],
  year: number
): MonthAvailability[] {
  const has = new Set<number>()
  for (const tx of transactions) {
    const y = calendarYearFromDate(tx.date)
    const m = calendarMonthFromDate(tx.date)
    if (y === year && m !== null) has.add(m)
  }
  const list: MonthAvailability[] = []
  for (let month = 1; month <= 12; month += 1) {
    list.push({ month, hasData: has.has(month) })
  }
  return list
}
