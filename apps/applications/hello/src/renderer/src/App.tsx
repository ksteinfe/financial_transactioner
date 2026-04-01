import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { AppManifest } from '@txn/app-contracts'
import { CategoryColorsPanel } from './CategoryColorsPanel'
import type {
  CorpusRescanResult,
  CorpusScanSummary,
  CorpusSummaryDocument,
  CorpusSummaryLoadResult,
  CorpusSummaryRebuildResult
} from '@txn/types'

declare global {
  interface Window {
    platform: {
      getAppVersion: () => Promise<string>
      checkForUpdates: () => Promise<unknown>
      chooseCorpusFolder: () => Promise<string | null>
      getStoredCorpusFolder: () => Promise<string | null>
      setStoredCorpusFolder: (folder: string | null) => Promise<void>
      scanCorpus: (rootPath: string) => Promise<CorpusScanSummary>
      rescanCorpus: () => Promise<CorpusRescanResult>
      rebuildCorpusSummary: () => Promise<CorpusSummaryRebuildResult>
      getCorpusSummary: () => Promise<CorpusSummaryLoadResult>
      getManifest: () => AppManifest
    }
  }
}

type SummaryPhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; doc: CorpusSummaryDocument }
  | { phase: 'missing' }
  | { phase: 'error'; message: string }

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function sortedYearKeys(years: Record<string, unknown>): string[] {
  return Object.keys(years).sort((a, b) => Number(a) - Number(b))
}

export function App(): ReactElement {
  const [version, setVersion] = useState<string>('…')
  const [manifest, setManifest] = useState<AppManifest | null>(null)
  const [folder, setFolder] = useState<string | null>(null)
  const [scan, setScan] = useState<CorpusScanSummary | null>(null)
  const [scanPending, setScanPending] = useState(false)
  const [summaryPhase, setSummaryPhase] = useState<SummaryPhase>({ phase: 'idle' })
  const [rebuildPending, setRebuildPending] = useState(false)

  const fetchSummary = useCallback(async (quiet: boolean) => {
    setSummaryPhase((prev) => {
      if (quiet && prev.phase === 'ready') return prev
      return { phase: 'loading' }
    })
    const result = await window.platform.getCorpusSummary()
    if (result.status === 'no_folder') {
      setSummaryPhase({ phase: 'idle' })
      return
    }
    if (result.status === 'missing') {
      setSummaryPhase({ phase: 'missing' })
      return
    }
    if (result.status === 'error') {
      setSummaryPhase({ phase: 'error', message: result.message })
      return
    }
    setSummaryPhase({ phase: 'ready', doc: result.summary })
  }, [])

  const rescan = useCallback(async (): Promise<void> => {
    setScanPending(true)
    try {
      const result = await window.platform.rescanCorpus()
      if (result.status === 'ok') {
        setScan(result.summary)
        setFolder(result.summary.rootPath)
        await fetchSummary(true)
      } else {
        setScan(null)
        setSummaryPhase({ phase: 'idle' })
      }
    } finally {
      setScanPending(false)
    }
  }, [fetchSummary])

  useEffect(() => {
    void window.platform.getAppVersion().then(setVersion)
    setManifest(window.platform.getManifest())
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await window.platform.getStoredCorpusFolder()
      if (cancelled || !stored) return
      setFolder(stored)
      await rescan()
    })()
    return () => {
      cancelled = true
    }
  }, [rescan])

  const modeLabel =
    manifest?.capabilities.canWriteCorpus === true ? 'Editor' : 'Reader'

  const pickFolder = async (): Promise<void> => {
    const chosen = await window.platform.chooseCorpusFolder()
    if (chosen === null) return
    await window.platform.setStoredCorpusFolder(chosen)
    setFolder(chosen)
    await rescan()
  }

  const clearFolder = async (): Promise<void> => {
    await window.platform.setStoredCorpusFolder(null)
    setFolder(null)
    setScan(null)
    setSummaryPhase({ phase: 'idle' })
  }

  const rebuildSummary = async (): Promise<void> => {
    setRebuildPending(true)
    try {
      const result = await window.platform.rebuildCorpusSummary()
      if (result.status === 'ok') {
        await fetchSummary(false)
      } else if (result.status === 'error') {
        setSummaryPhase({ phase: 'error', message: result.message })
      }
    } finally {
      setRebuildPending(false)
    }
  }

  const totalTx =
    scan?.years.reduce((n, y) => n + y.transactionCount, 0) ?? 0

  const summaryBusy = scanPending || rebuildPending || summaryPhase.phase === 'loading'

  let grandIn = 0
  let grandOut = 0
  let grandNet = 0
  let grandCount = 0
  if (summaryPhase.phase === 'ready') {
    for (const y of sortedYearKeys(summaryPhase.doc.years)) {
      const row = summaryPhase.doc.years[y]
      grandIn += row.inflow
      grandOut += row.outflow
      grandNet += row.net
      grandCount += row.transaction_count
    }
  }

  return (
    <main className="shell">
      <header className="header">
        <h1>Steinfeld Finance - Hello</h1>
        <p className="badge" data-mode={modeLabel}>
          Mode: {modeLabel}
        </p>
      </header>
      <section className="panel">
        <p className="hello">Hello, world</p>
        <dl className="meta">
          <dt>App version</dt>
          <dd>{version}</dd>
          <dt title="Stable id for this app variant (capabilities, packaging, telemetry).">
            App id
          </dt>
          <dd>{manifest?.id ?? '—'}</dd>
        </dl>

        <CategoryColorsPanel />

        <div className="corpus-actions">
          <button type="button" className="btn" onClick={() => void pickFolder()}>
            Choose corpus folder…
          </button>
          {folder !== null && (
            <>
              <button
                type="button"
                className="btn"
                disabled={scanPending}
                onClick={() => void rescan()}
                title="Reload yearly files and transaction counts from disk"
              >
                Rescan corpus
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void clearFolder()}>
                Clear saved folder
              </button>
            </>
          )}
        </div>

        {folder !== null && (
          <p className="path" title={folder}>
            <strong>Corpus:</strong> {folder}
          </p>
        )}

        {scanPending && <p className="status">Scanning corpus…</p>}

        {scan !== null && !scanPending && (
          <>
            {scan.diagnostics.length > 0 && (
              <ul className="diagnostics">
                {scan.diagnostics.map((d, i) => (
                  <li key={i} className={`diagnostic diagnostic-${d.severity}`}>
                    <span className="diagnostic-label">{d.severity}</span>
                    {d.path && <span className="diagnostic-path">{d.path}: </span>}
                    {d.message}
                  </li>
                ))}
              </ul>
            )}

            {scan.years.length === 0 && scan.diagnostics.length === 0 ? (
              <p className="muted">No <code>YYYY.json</code> files found in this folder.</p>
            ) : (
              <>
                <h2 className="table-title">Years in corpus</h2>
                <p className="muted small">
                  {scan.years.length} year file(s), {totalTx} transaction(s) total
                </p>
                <div className="table-wrap">
                  <table className="year-table">
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th>Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scan.years.map((row) => (
                        <tr key={row.year}>
                          <td>{row.year}</td>
                          <td>{row.transactionCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {folder !== null && scan !== null && !scanPending && scan.years.length > 0 && (
          <section className="summary-panel">
            <div className="summary-header">
              <h2 className="table-title summary-title">Corpus summary</h2>
              <p className="muted small summary-sub">
                Derived from <code>corpus-summary.json</code> (rollups by year). Rebuild after editing
                yearly files or to refresh totals.
              </p>
              <div className="corpus-actions summary-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={summaryBusy}
                  onClick={() => void rebuildSummary()}
                  title="Recompute corpus-summary.json from all YYYY.json files"
                >
                  {rebuildPending ? 'Rebuilding…' : 'Rebuild summary'}
                </button>
              </div>
            </div>

            {summaryPhase.phase === 'loading' && (
              <p className="status summary-status">Loading summary…</p>
            )}

            {summaryPhase.phase === 'missing' && (
              <div className="summary-missing">
                <p className="muted">
                  No summary file yet. Use <strong>Rebuild summary</strong> to create{' '}
                  <code>corpus-summary.json</code>.
                </p>
              </div>
            )}

            {summaryPhase.phase === 'error' && (
              <p className="diagnostic diagnostic-error summary-err" role="alert">
                <span className="diagnostic-label">error</span>
                {summaryPhase.message}
              </p>
            )}

            {summaryPhase.phase === 'ready' && (
              <>
                <dl className="meta summary-meta">
                  <dt>Last rebuild</dt>
                  <dd>{formatDateTime(summaryPhase.doc.metadata.last_updated)}</dd>
                  <dt>Summary schema</dt>
                  <dd>{summaryPhase.doc.metadata.version}</dd>
                </dl>
                <div className="table-wrap">
                  <table className="year-table summary-table">
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th className="num">Inflow</th>
                        <th className="num">Outflow</th>
                        <th className="num">Net</th>
                        <th className="num">Transactions</th>
                        <th>Months</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedYearKeys(summaryPhase.doc.years).map((y) => {
                        const row = summaryPhase.doc.years[y]
                        const monthCount = Object.keys(row.months).length
                        return (
                          <tr key={y}>
                            <td>{y}</td>
                            <td className="num">{formatMoney(row.inflow)}</td>
                            <td className="num">{formatMoney(row.outflow)}</td>
                            <td className="num">{formatMoney(row.net)}</td>
                            <td className="num">{row.transaction_count}</td>
                            <td>{monthCount}</td>
                          </tr>
                        )
                      })}
                      {sortedYearKeys(summaryPhase.doc.years).length > 0 && (
                        <tr className="summary-total">
                          <td>
                            <strong>All years</strong>
                          </td>
                          <td className="num">
                            <strong>{formatMoney(grandIn)}</strong>
                          </td>
                          <td className="num">
                            <strong>{formatMoney(grandOut)}</strong>
                          </td>
                          <td className="num">
                            <strong>{formatMoney(grandNet)}</strong>
                          </td>
                          <td className="num">
                            <strong>{grandCount}</strong>
                          </td>
                          <td>—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}
      </section>
    </main>
  )
}
