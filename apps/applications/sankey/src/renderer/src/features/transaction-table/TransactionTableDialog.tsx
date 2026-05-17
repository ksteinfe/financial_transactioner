import { useCallback, useEffect, useRef, type ReactElement, type MouseEvent } from 'react'
import type { CorpusTransaction } from '@txn/types'
import { IconButton } from '../../components/IconButton.js'
import { IconDownloadCsv } from '../../components/icons/index.js'
import { downloadTransactionsCsv } from './exportTransactionsCsv.js'
import { TransactionTable } from './TransactionTable.js'
import { useTransactionTableState } from './useTransactionTableState.js'

export interface TransactionTableDialogProps {
  title: string
  transactions: CorpusTransaction[]
  onClose: () => void
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

export function TransactionTableDialog({
  title,
  transactions,
  onClose
}: TransactionTableDialogProps): ReactElement {
  const closeRef = useRef<HTMLButtonElement>(null)
  const tableState = useTransactionTableState(transactions)
  const { displayedRows } = tableState

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onBackdropClick = useCallback(
    (e: MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  const onExportCsv = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10)
    const filename = `sankey-${slugify(title)}-${date}.csv`
    downloadTransactionsCsv(displayedRows, filename)
  }, [displayedRows, title])

  return (
    <div className="txn-dialog-backdrop" onClick={onBackdropClick} role="presentation">
      <div
        className="txn-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="txn-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="txn-dialog-header">
          <h2 id="txn-dialog-title" className="txn-dialog-title">
            {title}
          </h2>
          <span className="txn-dialog-count">
            {displayedRows.length} of {transactions.length} transaction
            {transactions.length === 1 ? '' : 's'}
          </span>
          <div className="txn-dialog-actions">
            <IconButton
              label="Download CSV"
              icon={<IconDownloadCsv />}
              disabled={displayedRows.length === 0}
              onClick={onExportCsv}
            />
            <button type="button" className="txn-dialog-close-btn" ref={closeRef} onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <div className="txn-dialog-body">
          <TransactionTable {...tableState} />
        </div>
      </div>
    </div>
  )
}
