import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { AppManifest } from '@txn/app-contracts'
import type { CorpusRescanResult, CorpusScanSummary } from '@txn/types'

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
      getManifest: () => AppManifest
    }
  }
}

export function App(): ReactElement {
  const [version, setVersion] = useState<string>('…')
  const [manifest, setManifest] = useState<AppManifest | null>(null)
  const [folder, setFolder] = useState<string | null>(null)
  const [scan, setScan] = useState<CorpusScanSummary | null>(null)
  const [scanPending, setScanPending] = useState(false)

  /** Refresh corpus from the persisted path (same API other apps use on load / after edits). */
  const rescan = useCallback(async (): Promise<void> => {
    setScanPending(true)
    try {
      const result = await window.platform.rescanCorpus()
      if (result.status === 'ok') {
        setScan(result.summary)
        setFolder(result.summary.rootPath)
      } else {
        setScan(null)
      }
    } finally {
      setScanPending(false)
    }
  }, [])

  useEffect(() => {
    void window.platform.getAppVersion().then(setVersion)
    setManifest(window.platform.getManifest())
  }, [])

  /** Auto-rescan on load when a corpus location is saved. */
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
  }

  const totalTx =
    scan?.years.reduce((n, y) => n + y.transactionCount, 0) ?? 0

  return (
    <main className="shell">
      <header className="header">
        <h1>moneylooksee - hello</h1>
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
      </section>
    </main>
  )
}
