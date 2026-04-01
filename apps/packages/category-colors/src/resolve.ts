import allowedCategories from '../../../../reference/allowed-categories.json' with { type: 'json' }
import defaultThemeJson from './category-color-theme.json' with { type: 'json' }
import type { Lab } from './lab.js'
import { hexToLab, labToHex, normalizeCanonicalHex } from './lab.js'

export interface LabRegion {
  LMin: number
  LMax: number
  aMin: number
  aMax: number
  bMin: number
  bMax: number
}

/**
 * Advanced major theme (optional). For normal use, a major is just a hex string in `CategoryColorTheme.majors`.
 */
export interface MajorTheme {
  label?: string
  /** Axis-aligned LAB box for generated minors (optional if `centerHex` is set). */
  region?: LabRegion
  /**
   * Seed sRGB hex. Region is built around `hexToLab(centerHex)` using default or custom half-extents,
   * then intersected with `labBounds` for placement when both are set.
   */
  centerHex?: string
  /** Half-width on L* (default 12). */
  halfL?: number
  /** Half-width on a* (default 20). */
  halfA?: number
  /** Half-width on b* (default 20). */
  halfB?: number
}

/** Normal form: `"#d17677"`. Same as `{ centerHex }` with default half-extents. */
export type MajorThemeEntry = string | MajorTheme

export interface ExplicitColor {
  /** CIELAB triple; converted to hex only (`labToHex`), not clipped by `labBounds`. */
  lab?: Lab
  /** sRGB hex emitted as-is (normalized to `#rrggbb`); no LAB round-trip or clipping. */
  hex?: string
}

/** Normal form: `"#ff00ff"`. Same as `{ hex: "…" }`; object form supports `lab` or mixed overrides. */
export type ExplicitColorEntry = string | ExplicitColor

/** Optional documentation strings in the theme JSON (ignored by the resolver). */
export interface CategoryColorThemeNotes {
  /** What `labBounds` does and what L*, a*, and b* represent. */
  labBounds?: string
  /** How `majors` hex strings are used. */
  majors?: string
  /** How `explicit` entries work. */
  explicit?: string
}

export interface CategoryColorTheme {
  version: number
  /** Embedded help for editors; not read by `getColorForCategory`. */
  _notes?: CategoryColorThemeNotes
  labBounds?: LabRegion
  /** Each major is a hex string, or a `MajorTheme` object for custom `region` / half-extents. */
  majors: Record<string, MajorThemeEntry>
  /**
   * Keys: full path `major:minor`, or **major-only** `major`. Per-path entries override major-only
   * for that row; major-only applies that color to every minor under the major.
   */
  explicit: Record<string, ExplicitColorEntry>
}

/** Public output is hex only; LAB is used only inside generated-color paths. */
export interface ResolvedCategoryColor {
  hex: string
}

const DEFAULT_ALLOWED: readonly string[] = allowedCategories as string[]

/** Parse `major:minor`; mirrors corpus-core behavior for malformed input. */
export function parseCategoryPath(category: string): { major: string; minor: string } {
  const i = category.indexOf(':')
  if (i <= 0) return { major: 'unknown', minor: 'undefined' }
  const major = category.slice(0, i).trim()
  const minor = category.slice(i + 1).trim()
  if (major.length === 0) return { major: 'unknown', minor: minor.length > 0 ? minor : 'undefined' }
  return { major, minor: minor.length > 0 ? minor : 'undefined' }
}

export function loadDefaultTheme(): CategoryColorTheme {
  return defaultThemeJson as CategoryColorTheme
}

/**
 * Explicit theme colors: hex strings are returned unchanged (normalized).
 * Object with `lab` only: encoded to hex via `labToHex` without `labBounds` clipping.
 * If both `hex` and `lab` are set, `hex` wins.
 */
function resolveExplicitToHex(entry: ExplicitColorEntry): string {
  if (typeof entry === 'string') {
    return normalizeCanonicalHex(entry)
  }
  if (entry.hex !== undefined && entry.hex !== '') {
    return normalizeCanonicalHex(entry.hex)
  }
  if (entry.lab) {
    return labToHex(entry.lab.L, entry.lab.a, entry.lab.b)
  }
  throw new Error('Explicit color must include hex or lab')
}

function clampLabToRegion(L: Lab, bounds: LabRegion): Lab {
  return {
    L: clamp(L.L, bounds.LMin, bounds.LMax),
    a: clamp(L.a, bounds.aMin, bounds.aMax),
    b: clamp(L.b, bounds.bMin, bounds.bMax)
  }
}

function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo
  if (x > hi) return hi
  return x
}

const DEFAULT_HALF_L = 12
const DEFAULT_HALF_A = 20
const DEFAULT_HALF_B = 20

function intersectRegions(a: LabRegion, b: LabRegion): LabRegion | null {
  const r: LabRegion = {
    LMin: Math.max(a.LMin, b.LMin),
    LMax: Math.min(a.LMax, b.LMax),
    aMin: Math.max(a.aMin, b.aMin),
    aMax: Math.min(a.aMax, b.aMax),
    bMin: Math.max(a.bMin, b.bMin),
    bMax: Math.min(a.bMax, b.bMax)
  }
  if (r.LMin > r.LMax || r.aMin > r.aMax || r.bMin > r.bMax) return null
  return r
}

/** Resolve a major theme entry to a LAB box (hex string, hex-centered object, or raw `region`). */
export function majorThemeToLabRegion(m: MajorThemeEntry, labBounds?: LabRegion): LabRegion {
  const obj: MajorTheme = typeof m === 'string' ? { centerHex: m } : m
  let raw: LabRegion
  if (obj.region) {
    raw = obj.region
  } else if (obj.centerHex) {
    const c = hexToLab(obj.centerHex)
    const hL = obj.halfL ?? DEFAULT_HALF_L
    const hA = obj.halfA ?? DEFAULT_HALF_A
    const hB = obj.halfB ?? DEFAULT_HALF_B
    raw = {
      LMin: c.L - hL,
      LMax: c.L + hL,
      aMin: c.a - hA,
      aMax: c.a + hA,
      bMin: c.b - hB,
      bMax: c.b + hB
    }
  } else {
    throw new Error('Major theme must include `region` or `centerHex` (or use a hex string)')
  }
  if (labBounds) {
    const cut = intersectRegions(raw, labBounds)
    if (cut) return cut
  }
  return raw
}

function regionForMajor(theme: CategoryColorTheme, major: string): LabRegion {
  const m = theme.majors[major]
  if (m) {
    try {
      return majorThemeToLabRegion(m, theme.labBounds)
    } catch {
      /* fall through */
    }
  }
  const u = theme.majors.unknown
  if (u) {
    return majorThemeToLabRegion(u, theme.labBounds)
  }
  throw new Error('Theme missing majors.unknown fallback')
}

/**
 * Place minors inside the major’s LAB box: **L\*** steps through the full height of the box
 * (so lightness varies across minors), while **a\*** and **b\*** use a 2D grid in the chroma
 * plane (hue / chroma separation near the major seed). Deterministic.
 */
export function labGridPlacement(index: number, count: number, region: LabRegion): Lab {
  if (count <= 0) throw new Error('count must be positive')
  if (index < 0 || index >= count) throw new Error('index out of range')

  const { LMin, LMax, aMin, aMax, bMin, bMax } = region
  const LSpan = LMax - LMin
  const aSpan = aMax - aMin
  const bSpan = bMax - bMin

  const L = LMin + ((index + 0.5) / count) * LSpan

  const gw = Math.max(1, Math.ceil(Math.sqrt(count)))
  const gh = Math.max(1, Math.ceil(count / gw))
  const col = index % gw
  const row = Math.floor(index / gw)
  const ua = (col + 0.5) / gw
  const ub = (row + 0.5) / gh
  const a = aMin + ua * aSpan
  const b = bMin + ub * bSpan

  return { L, a, b }
}

/** Mix FNV state for another uniform channel (deterministic). */
function fnvMix(h: number): number {
  return Math.imul(h ^ (h >>> 16), 2246822507) >>> 0
}

/** Deterministic LAB in region for non-canonical categories (independent L / a / b samples). */
export function labHashPlacement(category: string, region: LabRegion): Lab {
  let h = 2166136261
  for (let i = 0; i < category.length; i++) {
    h ^= category.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  const uL = (h & 0xffff) / 65535
  h = fnvMix(h)
  const ua = (h & 0xffff) / 65535
  h = fnvMix(h)
  const ub = (h & 0xffff) / 65535

  const { LMin, LMax, aMin, aMax, bMin, bMax } = region
  return {
    L: LMin + uL * (LMax - LMin),
    a: aMin + ua * (aMax - aMin),
    b: bMin + ub * (bMax - bMin)
  }
}

export function minorsForMajor(major: string, allowed: readonly string[] = DEFAULT_ALLOWED): string[] {
  const prefix = `${major}:`
  const out: string[] = []
  for (const path of allowed) {
    if (!path.startsWith(prefix)) continue
    const minor = path.slice(prefix.length)
    if (minor.length > 0) out.push(minor)
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

export function listAllowedCategories(allowed: readonly string[] = DEFAULT_ALLOWED): readonly string[] {
  return allowed
}

function finalizeLab(lab: Lab, theme: CategoryColorTheme): Lab {
  let L = lab
  if (theme.labBounds) {
    L = clampLabToRegion(L, theme.labBounds)
  }
  return L
}

/** Seed LAB for a major entry (hex string, `centerHex`, or center of `region`). */
function majorEntryToSeedLab(entry: MajorThemeEntry): Lab {
  if (typeof entry === 'string') {
    return hexToLab(entry)
  }
  if (entry.centerHex) {
    return hexToLab(entry.centerHex)
  }
  if (entry.region) {
    const r = entry.region
    return {
      L: (r.LMin + r.LMax) / 2,
      a: (r.aMin + r.aMax) / 2,
      b: (r.bMin + r.bMax) / 2
    }
  }
  throw new Error('Major theme entry must be a hex string, or include centerHex or region')
}

/**
 * Color for a **major** id only (e.g. `"food"`). If `theme.explicit[major]` is set, returns that
 * color; otherwise uses the theme’s `majors` seed hex (LAB clip pipeline).
 */
export function getColorForMajor(
  major: string,
  options?: { theme?: CategoryColorTheme }
): ResolvedCategoryColor {
  const theme = options?.theme ?? loadDefaultTheme()
  const key = major.trim()
  if (key.length === 0) {
    throw new Error('major must be non-empty')
  }
  const ex = theme.explicit[key]
  if (ex !== undefined && ex !== null) {
    return { hex: resolveExplicitToHex(ex) }
  }
  const entry = theme.majors[key] ?? theme.majors.unknown
  if (entry === undefined) {
    throw new Error('Theme missing majors entry and unknown fallback')
  }
  const lab = majorEntryToSeedLab(entry)
  const L = finalizeLab(lab, theme)
  return { hex: labToHex(L.L, L.a, L.b) }
}

/**
 * Resolve a display color as either a **major** (`"food"`) or **major:minor** (`"food:groceries"`).
 * Major-only strings contain no `:`; they use {@link getColorForMajor}. Full paths: per-row
 * `explicit["major:minor"]` wins, then `explicit["major"]` (all minors inherit), else generated
 * placement in the major’s LAB region.
 */
export function getColorForCategory(
  category: string,
  options?: { theme?: CategoryColorTheme; allowed?: readonly string[] }
): ResolvedCategoryColor {
  const theme = options?.theme ?? loadDefaultTheme()
  const allowed = options?.allowed ?? DEFAULT_ALLOWED
  const trimmed = category.trim()
  if (trimmed.length === 0) {
    throw new Error('category must be non-empty')
  }
  if (!trimmed.includes(':')) {
    return getColorForMajor(trimmed, { theme })
  }

  const { major, minor } = parseCategoryPath(trimmed)
  const fullKey = `${major}:${minor}`

  const exPath = theme.explicit[fullKey]
  if (exPath !== undefined && exPath !== null) {
    return { hex: resolveExplicitToHex(exPath) }
  }

  const exMajor = theme.explicit[major]
  if (exMajor !== undefined && exMajor !== null) {
    return { hex: resolveExplicitToHex(exMajor) }
  }

  const region = regionForMajor(theme, major)
  const allMinors = minorsForMajor(major, allowed)
  const generatedMinors = allMinors.filter((m) => !theme.explicit[`${major}:${m}`])
  const n = generatedMinors.length

  if (n === 0) {
    const lab = labHashPlacement(fullKey, region)
    const L = finalizeLab(lab, theme)
    return { hex: labToHex(L.L, L.a, L.b) }
  }

  if (allMinors.includes(minor)) {
    const idx = generatedMinors.indexOf(minor)
    const lab = labGridPlacement(idx, n, region)
    const L = finalizeLab(lab, theme)
    return { hex: labToHex(L.L, L.a, L.b) }
  }

  const lab = labHashPlacement(fullKey, region)
  const L = finalizeLab(lab, theme)
  return { hex: labToHex(L.L, L.a, L.b) }
}
