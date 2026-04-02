/**
 * Rounded dollars; abbreviate at |value| >= 1000 (e.g. $1.2k).
 */
export function formatCurrencyShort(value: number): string {
  const a = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (a >= 1000) {
    const k = a / 1000
    const s = k >= 10 ? k.toFixed(1) : k.toFixed(1).replace(/\.0$/, '')
    return `${sign}$${s}k`
  }
  return `${sign}$${Math.round(a)}`
}
