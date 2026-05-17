import { describe, expect, it } from 'vitest'
import { truncateDisplay } from './truncateDisplay.js'

describe('truncateDisplay', () => {
  it('leaves short strings unchanged', () => {
    expect(truncateDisplay('food:grocery')).toBe('food:grocery')
  })

  it('truncates at 20 chars with ellipsis', () => {
    const long = 'transfer:6934_checking'
    expect(truncateDisplay(long)).toBe('transfer:6934_checki...')
    expect(truncateDisplay(long).length).toBe(23)
  })
})
