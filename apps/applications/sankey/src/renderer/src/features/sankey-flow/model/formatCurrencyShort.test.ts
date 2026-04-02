import { describe, expect, it } from 'vitest'
import { formatCurrencyShort } from './formatCurrencyShort.js'

describe('formatCurrencyShort', () => {
  it('formats small amounts', () => {
    expect(formatCurrencyShort(243)).toBe('$243')
    expect(formatCurrencyShort(999)).toBe('$999')
  })
  it('abbreviates at 1000+', () => {
    expect(formatCurrencyShort(1000)).toBe('$1k')
    expect(formatCurrencyShort(1200)).toBe('$1.2k')
    expect(formatCurrencyShort(12400)).toBe('$12.4k')
  })
})
