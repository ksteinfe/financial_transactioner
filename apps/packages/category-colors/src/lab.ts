/**
 * CIELAB (D65) ↔ XYZ ↔ linear sRGB. Display output uses sRGB with components
 * clamped to [0, 1] before gamma encoding (deterministic out-of-gamut handling).
 */

/**
 * D65 reference white in **same units as `linearRgbToXyz`** (XYZ from linear sRGB 0–1).
 * Linear RGB (1,1,1) maps to this XYZ; using matching scale fixes LAB vs 0–100 XYZ mismatch.
 */
export const D65_XN = 0.950469679
export const D65_YN = 1.0
export const D65_ZN = 1.088830004

const ε = 216 / 24389
const κ = 24389 / 27

export interface Lab {
  L: number
  a: number
  b: number
}

/** Bruce Lindbloom: http://www.brucelindbloom.com/index.html?Eqn_XYZ_to_Lab.html */
export function xyzToLab(x: number, y: number, z: number): Lab {
  let xr = x / D65_XN
  let yr = y / D65_YN
  let zr = z / D65_ZN

  const fx = xr > ε ? Math.cbrt(xr) : (κ * xr + 16) / 116
  const fy = yr > ε ? Math.cbrt(yr) : (κ * yr + 16) / 116
  const fz = zr > ε ? Math.cbrt(zr) : (κ * zr + 16) / 116

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  }
}

/** Bruce Lindbloom: http://www.brucelindbloom.com/index.html?Eqn_Lab_to_XYZ.html */
export function labToXyz(L: number, a: number, b: number): { x: number; y: number; z: number } {
  const fy = (L + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200

  const fx3 = fx * fx * fx
  const fz3 = fz * fz * fz
  const xr = fx3 > ε ? fx3 : (116 * fx - 16) / κ
  const yr = L > 8 ? Math.pow((L + 16) / 116, 3) : L / κ
  const zr = fz3 > ε ? fz3 : (116 * fz - 16) / κ

  return {
    x: xr * D65_XN,
    y: yr * D65_YN,
    z: zr * D65_ZN
  }
}

/** sRGB D65: linear RGB [0,1] → XYZ */
export function linearRgbToXyz(r: number, g: number, b: number): { x: number; y: number; z: number } {
  return {
    x: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    y: 0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    z: 0.0193339 * r + 0.119192 * g + 0.9503041 * b
  }
}

/** XYZ → linear sRGB [0,1] (may be out of gamut; clamp later). */
export function xyzToLinearRgb(x: number, y: number, z: number): { r: number; g: number; b: number } {
  const r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
  const g = -0.969266 * x + 1.8760108 * y + 0.041556 * z
  const b = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
  return { r, g, b }
}

export function srgbChannelToLinear(u: number): number {
  if (u <= 0.04045) return u / 12.92
  return Math.pow((u + 0.055) / 1.055, 2.4)
}

export function linearToSrgbChannel(u: number): number {
  if (u <= 0.0031308) return 12.92 * u
  return 1.055 * Math.pow(u, 1 / 2.4) - 0.055
}

/** Normalize a 6-digit sRGB `#RRGGBB` string (no conversion). */
export function normalizeCanonicalHex(hex: string): string {
  const s = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`Expected #RRGGBB hex: ${hex}`)
  }
  return `#${s.toLowerCase()}`
}

export function hexToSrgbLinear(hex: string): { r: number; g: number; b: number } {
  const s = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`Invalid hex color: ${hex}`)
  }
  const n = parseInt(s, 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return {
    r: srgbChannelToLinear(r),
    g: srgbChannelToLinear(g),
    b: srgbChannelToLinear(b)
  }
}

export function linearRgbToHex(r: number, g: number, b: number): string {
  const rr = Math.round(clamp01(linearToSrgbChannel(r)) * 255)
  const gg = Math.round(clamp01(linearToSrgbChannel(g)) * 255)
  const bb = Math.round(clamp01(linearToSrgbChannel(b)) * 255)
  return `#${[rr, gg, bb].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

export function labToHex(L: number, a: number, b: number): string {
  const { x, y, z } = labToXyz(L, a, b)
  let { r, g, b: bl } = xyzToLinearRgb(x, y, z)
  r = clamp01(r)
  g = clamp01(g)
  bl = clamp01(bl)
  return linearRgbToHex(r, g, bl)
}

export function hexToLab(hex: string): Lab {
  const { r, g, b } = hexToSrgbLinear(hex)
  const { x, y, z } = linearRgbToXyz(r, g, b)
  return xyzToLab(x, y, z)
}

/** CSS Color Module Level 4 `lab()` — L is 0–100, a/b in roughly ±160. */
export function labToCssLab(L: number, a: number, b: number): string {
  const q = (n: number) => {
    const t = n.toFixed(2)
    return t.replace(/\.?0+$/, '')
  }
  return `lab(${q(L)} ${q(a)} ${q(b)})`
}
