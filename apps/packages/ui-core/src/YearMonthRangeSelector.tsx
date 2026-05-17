import { useCallback, useMemo, useRef } from 'react'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface MonthAvailability {
  month: number
  hasData: boolean
}

export interface YearMonthRangeSelectorValue {
  year: number
  startMonth: number
  endMonth: number
  /** Non-contiguous selection; when omitted, [startMonth, endMonth] inclusive is used. */
  months?: number[]
}

export interface YearMonthRangeSelectorProps {
  availableYears: number[]
  value: YearMonthRangeSelectorValue
  monthAvailability: MonthAvailability[]
  onChange: (value: YearMonthRangeSelectorValue) => void
  disabled?: boolean
}

function resolveSelectedMonths(value: YearMonthRangeSelectorValue): number[] {
  if (value.months !== undefined) return value.months
  const lo = Math.min(value.startMonth, value.endMonth)
  const hi = Math.max(value.startMonth, value.endMonth)
  const out: number[] = []
  for (let m = lo; m <= hi; m += 1) out.push(m)
  return out
}

function isContiguous(months: number[]): boolean {
  if (months.length === 0) return true
  const sorted = [...months].sort((a, b) => a - b)
  return sorted.length === sorted[sorted.length - 1]! - sorted[0]! + 1
}

function commitSelection(
  year: number,
  months: number[],
  onChange: (v: YearMonthRangeSelectorValue) => void
): void {
  const unique = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b)
  if (unique.length === 0) {
    onChange({ year, startMonth: 0, endMonth: 0, months: [] })
    return
  }
  onChange({
    year,
    startMonth: unique[0]!,
    endMonth: unique[unique.length - 1]!,
    months: isContiguous(unique) ? undefined : unique
  })
}

function commitContiguousRange(
  year: number,
  start: number,
  end: number,
  onChange: (v: YearMonthRangeSelectorValue) => void
): void {
  const s = Math.min(start, end)
  const e = Math.max(start, end)
  onChange({ year, startMonth: s, endMonth: e, months: undefined })
}

function monthFromPointer(e: React.PointerEvent): number | null {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const btn = el?.closest<HTMLButtonElement>('[data-month]')
  if (!btn?.dataset.month) return null
  const m = Number.parseInt(btn.dataset.month, 10)
  return m >= 1 && m <= 12 ? m : null
}

function modifierClick(e: React.PointerEvent): boolean {
  return e.ctrlKey || e.metaKey
}

export function YearMonthRangeSelector({
  availableYears,
  value,
  monthAvailability,
  onChange,
  disabled = false
}: YearMonthRangeSelectorProps): React.ReactElement {
  const monthsRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ anchor: number; end: number } | null>(null)

  const selectedMonths = useMemo(() => resolveSelectedMonths(value), [value])
  const selectedSet = useMemo(() => new Set(selectedMonths), [selectedMonths])
  const selectionContiguous = useMemo(() => isContiguous(selectedMonths), [selectedMonths])

  const availByMonth = useMemo(() => {
    const m = new Map<number, boolean>()
    for (const x of monthAvailability) {
      m.set(x.month, x.hasData)
    }
    return m
  }, [monthAvailability])

  const onYearChange = useCallback(
    (y: number) => {
      dragRef.current = null
      commitSelection(y, resolveSelectedMonths(value), onChange)
    },
    [onChange, value]
  )

  const toggleMonth = useCallback(
    (month: number) => {
      const next = new Set(resolveSelectedMonths(value))
      if (next.has(month)) next.delete(month)
      else next.add(month)
      commitSelection(value.year, [...next], onChange)
    },
    [onChange, value]
  )

  const finishDrag = useCallback(
    (anchor: number, end: number) => {
      commitContiguousRange(value.year, anchor, end, onChange)
    },
    [onChange, value.year]
  )

  const onMonthPointerDown = useCallback(
    (e: React.PointerEvent, month: number) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()

      if (modifierClick(e)) {
        dragRef.current = null
        toggleMonth(month)
        return
      }

      monthsRef.current?.setPointerCapture(e.pointerId)
      dragRef.current = { anchor: month, end: month }
      finishDrag(month, month)
    },
    [disabled, finishDrag, toggleMonth]
  )

  const onMonthsPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || !dragRef.current || modifierClick(e)) return
      const month = monthFromPointer(e)
      if (month === null || month === dragRef.current.end) return
      dragRef.current = { anchor: dragRef.current.anchor, end: month }
      finishDrag(dragRef.current.anchor, month)
    },
    [disabled, finishDrag]
  )

  const endPointer = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      finishDrag(drag.anchor, drag.end)
      dragRef.current = null
      try {
        monthsRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* released */
      }
    },
    [finishDrag]
  )

  const minSelected = selectedMonths[0]
  const maxSelected = selectedMonths[selectedMonths.length - 1]

  return (
    <div className="txn-ym-range">
      <div className="txn-ym-range-row">
        <span className="txn-ym-range-label">Year</span>
        <select
          className="txn-ym-range-select"
          value={value.year}
          disabled={disabled || availableYears.length === 0}
          onChange={(e) => onYearChange(Number.parseInt(e.target.value, 10))}
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="txn-ym-range-row">
        <span className="txn-ym-range-label">Months</span>
        <div
          ref={monthsRef}
          className="txn-ym-months"
          role="group"
          aria-label="Month range — click or drag; Ctrl+click to add or remove months"
          style={{ touchAction: 'none' }}
          onPointerMove={onMonthsPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        >
          {MONTH_LABELS.map((label, i) => {
            const month = i + 1
            const faded = !(availByMonth.get(month) ?? false)
            const selected = selectedSet.has(month)
            const edge =
              selectionContiguous &&
              selected &&
              minSelected !== undefined &&
              maxSelected !== undefined &&
              (month === minSelected || month === maxSelected)
            const cls = [
              'txn-ym-month',
              faded ? 'txn-ym-month--faded' : '',
              selected ? 'txn-ym-month--in-range' : '',
              edge ? 'txn-ym-month--edge' : ''
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={month}
                type="button"
                className={cls}
                data-month={month}
                disabled={disabled}
                onPointerDown={(e) => onMonthPointerDown(e, month)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
