import { describe, expect, it } from 'vitest'
import { normalizeAssetSvg } from './normalizeAssetSvg.js'

describe('normalizeAssetSvg', () => {
  it('keeps viewBox and uses currentColor', () => {
    const raw =
      '<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#333"><path d="M0 0"/></svg>'
    const out = normalizeAssetSvg(raw)
    expect(out).toContain('viewBox="0 -960 960 960"')
    expect(out).toContain('fill="currentColor"')
    expect(out).not.toContain('width=')
    expect(out).not.toContain('height=')
    expect(out).not.toContain('#333')
  })
})
