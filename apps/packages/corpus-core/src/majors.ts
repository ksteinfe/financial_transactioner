/**
 * Default major category keys derived from `reference/allowed-categories.json`
 * (first segment before `:`). Used so month rollups include a stable full grid;
 * any major seen in data but not listed here is merged in as well.
 */
export const DEFAULT_MAJOR_CATEGORY_KEYS: readonly string[] = [
  'childcare',
  'education',
  'entertainment',
  'financial',
  'food',
  'gift',
  'health',
  'home',
  'income',
  'kids',
  'personal_care',
  'professional',
  'project',
  'rare',
  'reimbursment',
  'savings',
  'shopping',
  'tax',
  'transfer',
  'transportation',
  'unknown'
] as const
