import type { CorpusTransaction } from '@txn/types'

export async function copyTransactionJson(tx: CorpusTransaction): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify(tx, null, 2))
}
