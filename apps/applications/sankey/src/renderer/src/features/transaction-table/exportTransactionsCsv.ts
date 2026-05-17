import type { CorpusTransaction } from '@txn/types'

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function transactionsToCsv(rows: CorpusTransaction[]): string {
  const headers = ['date', 'amount', 'account', 'category', 'description', 'notes']
  const lines = [headers.join(',')]
  for (const tx of rows) {
    const fields = [
      tx.date,
      String(tx.amount),
      tx.account,
      tx.category,
      tx.description,
      tx.notes ?? ''
    ]
    lines.push(fields.map(escapeCsvField).join(','))
  }
  return lines.join('\n')
}

export function downloadTransactionsCsv(rows: CorpusTransaction[], filename: string): void {
  const csv = transactionsToCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
