/** `YYYY-MM` from `YYYY-MM-DD`, or null if invalid. */
export function monthKeyFromDate(isoDate: string): string | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate.trim())
  if (!m) return null
  return `${m[1]}-${m[2]}`
}

/** Calendar month 1–12 from `YYYY-MM-DD`, or null. */
export function calendarMonthFromDate(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate.trim())
  if (!m) return null
  return Number.parseInt(m[2], 10)
}

/** Calendar year from `YYYY-MM-DD`, or null. */
export function calendarYearFromDate(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate.trim())
  if (!m) return null
  return Number.parseInt(m[1], 10)
}
