import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import type { CorpusScanSummary, CorpusTransaction } from '@txn/types'
import { monthAvailabilityForYear } from '@txn/corpus-core/pure'
import { AppCanvas, type CanvasTransform, YearMonthRangeSelector } from '@txn/ui-core'
import { SankeyChart } from './features/sankey-flow/SankeyChart.js'
import { buildSankeyDiagramModel } from './features/sankey-flow/model/buildSankeyDiagramModel.js'

export function App(): ReactElement {
  const [folder, setFolder] = useState<string | null>(null)
  const [scan, setScan] = useState<CorpusScanSummary | null>(null)
  const [yearData, setYearData] = useState<{ year: number; transactions: CorpusTransaction[] } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [range, setRange] = useState({ year: new Date().getFullYear(), startMonth: 1, endMonth: 12 })
  const [canvasTransform, setCanvasTransform] = useState<CanvasTransform>({ x: 0, y: 0, k: 1 })
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, { dx: number; dy: number }>>({})
  const [tooltip, setTooltip] = useState<string | null>(null)

  const rescan = useCallback(async (): Promise<void> => {
    setPending(true)
    try {
      const result = await window.platform.rescanCorpus()
      if (result.status === 'ok') {
        setScan(result.summary)
        setFolder(result.summary.rootPath)
      } else {
        setScan(null)
      }
    } finally {
      setPending(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const stored = await window.platform.getStoredCorpusFolder()
      if (stored) {
        setFolder(stored)
        await rescan()
      }
    })()
  }, [rescan])

  const availableYears = useMemo(() => (scan?.years ?? []).map((y) => y.year), [scan])

  useEffect(() => {
    if (availableYears.length === 0) return
    if (!availableYears.includes(range.year)) {
      setRange((r) => ({ ...r, year: availableYears[availableYears.length - 1] }))
    }
  }, [availableYears, range.year])

  useEffect(() => {
    if (!folder || availableYears.length === 0) return
    const y = range.year
    let cancelled = false
    void (async () => {
      setPending(true)
      setLoadError(null)
      try {
        const result = await window.platform.loadCorpusYearFile(y)
        if (cancelled) return
        if (result.status === 'no_folder') {
          setYearData(null)
          setLoadError('No corpus folder')
          return
        }
        if (result.status === 'missing_file') {
          setYearData(null)
          setLoadError(`Missing ${y}.json`)
          return
        }
        if (result.status === 'error') {
          setYearData(null)
          setLoadError(result.message)
          return
        }
        setYearData({ year: y, transactions: result.file.transactions })
      } finally {
        if (!cancelled) setPending(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [folder, range.year, availableYears.length])

  const monthAvailability = useMemo(() => {
    if (!yearData) return []
    return monthAvailabilityForYear(yearData.transactions, yearData.year)
  }, [yearData])

  const diagram = useMemo(() => {
    if (!yearData) return null
    return buildSankeyDiagramModel(
      yearData.transactions,
      range.year,
      range.startMonth,
      range.endMonth
    )
  }, [yearData, range.year, range.startMonth, range.endMonth])

  const onChooseFolder = useCallback(async () => {
    const p = await window.platform.chooseCorpusFolder()
    if (p) {
      await window.platform.setStoredCorpusFolder(p)
      setFolder(p)
      const s = await window.platform.scanCorpus(p)
      setScan(s)
    }
  }, [])

  const onNodeDrag = useCallback((nodeId: string, dx: number, dy: number) => {
    setNodeOverrides((prev) => {
      const cur = prev[nodeId] ?? { dx: 0, dy: 0 }
      return { ...prev, [nodeId]: { dx: cur.dx + dx, dy: cur.dy + dy } }
    })
  }, [])

  const resetNodePositions = useCallback(() => setNodeOverrides({}), [])

  const integrityWarning = diagram?.integrityErrors.length ? diagram.integrityErrors.join(' | ') : null

  const chartW = 960
  const chartH = 720

  return (
    <div className="sankey-app">
      <header className="sankey-header">
        <h1>Steinfeld Finance — Sankey</h1>
        <div className="sankey-header-actions">
          <button type="button" onClick={() => void onChooseFolder()} disabled={pending}>
            Choose corpus folder
          </button>
          <button type="button" onClick={() => void rescan()} disabled={pending || !folder}>
            Rescan
          </button>
          {folder ? <span className="sankey-folder">{folder}</span> : <span className="muted">No folder selected</span>}
        </div>
      </header>

      <div className="sankey-controls">
        <YearMonthRangeSelector
          availableYears={availableYears}
          value={range}
          monthAvailability={monthAvailability}
          onChange={setRange}
          disabled={pending || availableYears.length === 0}
        />
        {loadError ? <p className="sankey-error">{loadError}</p> : null}
        {integrityWarning ? <p className="sankey-error">Integrity: {integrityWarning}</p> : null}
        {tooltip ? <p className="sankey-tooltip">{tooltip}</p> : null}
      </div>

      <div className="sankey-canvas-wrap">
        <AppCanvas
          minZoom={0.15}
          maxZoom={6}
          initialFit
          onTransformChange={setCanvasTransform}
          contentBounds={{ width: chartW, height: chartH }}
          toolbarExtra={
            <button type="button" onClick={resetNodePositions}>
              Reset node positions
            </button>
          }
        >
          {diagram ? (
            <SankeyChart
              sections={diagram.sections}
              width={chartW}
              height={chartH}
              nodeOverrides={nodeOverrides}
              onNodeDrag={onNodeDrag}
              onHover={(h) => setTooltip(h ? h.text : null)}
            />
          ) : (
            <rect width={chartW} height={chartH} fill="transparent" />
          )}
        </AppCanvas>
      </div>

      <footer className="sankey-footer muted">
        Zoom: {canvasTransform.k.toFixed(2)}× — use canvas toolbar for Fit / Reset view.
      </footer>
    </div>
  )
}
