/**
 * Prepare an SVG file string for use inside `.txn-icon-btn__icon` (16×16 via CSS).
 * Keeps the file's viewBox (e.g. Material `0 -960 960 960`); strips fixed width/height.
 */
export function normalizeAssetSvg(raw: string): string {
  return raw
    .replace(/\s(width|height)="[^"]*"/gi, '')
    .replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
      const withoutFill = attrs.replace(/\sfill="[^"]*"/gi, '')
      return `<svg${withoutFill} fill="currentColor" aria-hidden="true">`
    })
}
