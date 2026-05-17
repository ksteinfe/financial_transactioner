export const CATEGORY_DISPLAY_MAX = 20

export function truncateDisplay(text: string, maxLen = CATEGORY_DISPLAY_MAX): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}...`
}
