import type { CorpusTransaction } from '@txn/types'
import { calendarMonthFromDate, calendarYearFromDate } from '../month.js'

export interface MonthAvailability {
  month: number
  hasData: boolean
}

export interface YearMonthSelection {
  startMonth: number
  endMonth: number
  /** When set, only these calendar months (1–12) are included; may be non-contiguous. */
  months?: number[]
}

/** Months included in a selection (explicit list or contiguous start–end). */
export function resolveSelectedMonths(selection: YearMonthSelection): number[] {
  if (selection.months !== undefined) return selection.months
  const lo = Math.min(selection.startMonth, selection.endMonth)
  const hi = Math.max(selection.startMonth, selection.endMonth)
  const out: number[] = []
  for (let m = lo; m <= hi; m += 1) out.push(m)
  return out
}

/**
 * Keep transactions whose date falls in `year` and in the selected month(s).
 * Pass `months` for a non-contiguous set; otherwise [startMonth, endMonth] inclusive.
 */
export function filterTransactionsByYearMonthRange(
  transactions: CorpusTransaction[],
  year: number,
  startMonth: number,
  endMonth: number,
  months?: number[]
): CorpusTransaction[] {
  const allowed =
    months !== undefined ? new Set(months) : null
  const lo = Math.min(startMonth, endMonth)
  const hi = Math.max(startMonth, endMonth)
  if (allowed !== null && allowed.size === 0) return []
  const out: CorpusTransaction[] = []
  for (const tx of transactions) {
    const y = calendarYearFromDate(tx.date)
    const m = calendarMonthFromDate(tx.date)
    if (y === null || m === null) continue
    if (y !== year) continue
    if (allowed !== null) {
      if (!allowed.has(m)) continue
    } else if (m < lo || m > hi) {
      continue
    }
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
