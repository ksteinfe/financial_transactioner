import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import allowedCategories from '../../../../reference/allowed-categories.json' with { type: 'json' }
import { hexToLab, labToHex } from './lab.js'
import {
  getColorForCategory,
  getColorForMajor,
  labGridPlacement,
  loadDefaultTheme,
  minorsForMajor,
  parseCategoryPath
} from './resolve.js'
import type { CategoryColorTheme } from './resolve.js'

describe('parseCategoryPath', () => {
  it('parses canonical categories', () => {
    assert.deepEqual(parseCategoryPath('food:groceries'), { major: 'food', minor: 'groceries' })
  })
  it('falls back for malformed input', () => {
    assert.deepEqual(parseCategoryPath('bad'), { major: 'unknown', minor: 'undefined' })
  })
})

describe('lab roundtrip', () => {
  it('hex -> lab -> hex is stable for mid gray', () => {
    const hex = '#808080'
    const lab = hexToLab(hex)
    const out = labToHex(lab.L, lab.a, lab.b)
    assert.equal(out.toLowerCase(), hex)
  })
})

describe('theme vs allowed list', () => {
  it('every explicit key is a full path in allowed list or a major present in allowed paths', () => {
    const theme = loadDefaultTheme()
    const allowed = new Set(allowedCategories as string[])
    const majorsFromAllowed = new Set<string>()
    for (const path of allowedCategories as string[]) {
      const i = path.indexOf(':')
      if (i > 0) majorsFromAllowed.add(path.slice(0, i))
    }
    for (const key of Object.keys(theme.explicit)) {
      if (key.includes(':')) {
        assert.ok(allowed.has(key), `explicit path ${key} not in allowed-categories.json`)
      } else {
        assert.ok(
          majorsFromAllowed.has(key),
          `explicit major-only key ${key} is not a major in allowed-categories.json`
        )
      }
    }
  })
  it('every major in theme exists in allowed categories', () => {
    const theme = loadDefaultTheme()
    const majorsFromAllowed = new Set<string>()
    for (const path of allowedCategories as string[]) {
      const i = path.indexOf(':')
      if (i > 0) majorsFromAllowed.add(path.slice(0, i))
    }
    for (const major of Object.keys(theme.majors)) {
      assert.ok(majorsFromAllowed.has(major), `theme major ${major} not present in allowed list`)
    }
  })
})

describe('getColorForMajor', () => {
  it('returns clipped seed hex from theme majors', () => {
    const a = getColorForMajor('food')
    const b = getColorForMajor('food')
    assert.equal(a.hex, b.hex)
    assert.ok(/^#[0-9a-f]{6}$/i.test(a.hex))
  })
  it('matches getColorForCategory when no colon', () => {
    assert.equal(getColorForCategory('food').hex, getColorForMajor('food').hex)
  })
})

describe('getColorForCategory', () => {
  it('returns stable output for food:groceries', () => {
    const a = getColorForCategory('food:groceries')
    const b = getColorForCategory('food:groceries')
    assert.equal(a.hex, b.hex)
    assert.ok(a.hex.startsWith('#'))
  })
  it('uses shared explicit magenta for special unknown/rare keys', () => {
    const paths = [
      'unknown:undefined',
      'unknown:unaccounted_cash',
      'unknown:unaccounted_transfer',
      'rare:parking_ticket'
    ]
    const hex = getColorForCategory(paths[0]!).hex.toLowerCase()
    for (const p of paths) {
      assert.equal(getColorForCategory(p).hex.toLowerCase(), hex)
    }
    assert.equal(hex, '#ff00ff')
  })
  it('prefers explicit hex over lab when both are set', () => {
    const base = loadDefaultTheme()
    const theme: CategoryColorTheme = {
      ...base,
      explicit: {
        ...base.explicit,
        'food:misc': { hex: '#00ff00', lab: { L: 10, a: 0, b: 0 } }
      }
    }
    const c = getColorForCategory('food:misc', { theme })
    assert.equal(c.hex.toLowerCase(), '#00ff00')
  })
  it('is deterministic across calls for all allowed categories', () => {
    const allowed = allowedCategories as string[]
    const first = new Map<string, string>()
    for (const path of allowed) {
      first.set(path, getColorForCategory(path).hex)
    }
    for (const path of allowed) {
      assert.equal(getColorForCategory(path).hex, first.get(path))
    }
  })
})

describe('labGridPlacement', () => {
  it('places distinct indices in the same region', () => {
    const region = {
      LMin: 50,
      LMax: 70,
      aMin: -20,
      aMax: 20,
      bMin: -20,
      bMax: 20
    }
    const p0 = labGridPlacement(0, 3, region)
    const p1 = labGridPlacement(1, 3, region)
    const d =
      (p0.L - p1.L) * (p0.L - p1.L) +
      (p0.a - p1.a) * (p0.a - p1.a) +
      (p0.b - p1.b) * (p0.b - p1.b)
    assert.ok(d > 1e-6)
  })
  it('spreads L* across index and keeps a*b* on a grid', () => {
    const region = {
      LMin: 40,
      LMax: 80,
      aMin: -10,
      aMax: 10,
      bMin: -10,
      bMax: 10
    }
    const p0 = labGridPlacement(0, 4, region)
    const p3 = labGridPlacement(3, 4, region)
    assert.ok(Math.abs(p3.L - p0.L) > 1e-6, 'L should vary with index')
  })
})

describe('minorsForMajor', () => {
  it('lists sorted minors for food', () => {
    const m = minorsForMajor('food')
    assert.ok(m.includes('groceries'))
    assert.ok(m.length >= 8)
  })
})

describe('custom theme', () => {
  it('respects explicit hex override', () => {
    const base = loadDefaultTheme()
    const theme: CategoryColorTheme = {
      ...base,
      explicit: {
        ...base.explicit,
        'food:groceries': '#ff00ff'
      }
    }
    const c = getColorForCategory('food:groceries', { theme })
    assert.equal(c.hex.toLowerCase(), '#ff00ff')
  })

  it('major-level explicit applies to all minors; per-path still wins', () => {
    const base = loadDefaultTheme()
    const theme: CategoryColorTheme = {
      ...base,
      explicit: {
        ...base.explicit,
        food: '#112233',
        'food:misc': '#abcdef'
      }
    }
    assert.equal(getColorForCategory('food:groceries', { theme }).hex.toLowerCase(), '#112233')
    assert.equal(getColorForCategory('food:misc', { theme }).hex.toLowerCase(), '#abcdef')
    assert.equal(getColorForMajor('food', { theme }).hex.toLowerCase(), '#112233')
  })
})
