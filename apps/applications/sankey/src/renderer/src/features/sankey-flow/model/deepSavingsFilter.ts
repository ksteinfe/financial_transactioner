import type { CorpusTransaction } from '@txn/types'

/** Accounts treated as "deep savings" — hidden from flow visualizations by default. */
export const DEEP_SAVINGS_ACCOUNTS: readonly string[] = ['boa_savings_1816']

/**
 * Drop transactions whose `account` is in `accounts`.
 * Used to exclude deep-savings accounts before Sankey model / drill-down parsing.
 */
export function excludeAccounts(
  transactions: readonly CorpusTransaction[],
  accounts: readonly string[]
): CorpusTransaction[] {
  if (accounts.length === 0) return [...transactions]
  const hide = new Set(accounts)
  return transactions.filter((tx) => !hide.has(tx.account))
}
