/**
 * Parse `major:minor` from a category path (corpus contract).
 */
export function parseCategory(category: string): { major: string; minor: string } {
  const i = category.indexOf(':')
  if (i <= 0) return { major: 'unknown', minor: 'undefined' }
  const major = category.slice(0, i).trim()
  const minor = category.slice(i + 1).trim()
  if (major.length === 0) return { major: 'unknown', minor: minor.length > 0 ? minor : 'undefined' }
  return { major, minor: minor.length > 0 ? minor : 'undefined' }
}
