import { useCallback, useMemo, useState } from 'react'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface MonthAvailability {
  month: number
  hasData: boolean
}

export interface YearMonthRangeSelectorValue {
  year: number
  startMonth: number
  endMonth: number
}

export interface YearMonthRangeSelectorProps {
  availableYears: number[]
  value: YearMonthRangeSelectorValue
  monthAvailability: MonthAvailability[]
  onChange: (value: YearMonthRangeSelectorValue) => void
  disabled?: boolean
}

function clampRange(
  year: number,
  start: number,
  end: number,
  onChange: (v: YearMonthRangeSelectorValue) => void
): void {
  const s = Math.min(start, end)
  const e = Math.max(start, end)
  onChange({ year, startMonth: s, endMonth: e })
}

export function YearMonthRangeSelector({
  availableYears,
  value,
  monthAvailability,
  onChange,
  disabled = false
}: YearMonthRangeSelectorProps): React.ReactElement {
  const [rangeAnchor, setRangeAnchor] = useState<number | null>(null)

  const availByMonth = useMemo(() => {
    const m = new Map<number, boolean>()
    for (const x of monthAvailability) {
      m.set(x.month, x.hasData)
    }
    return m
  }, [monthAvailability])

  const onYearChange = useCallback(
    (y: number) => {
      setRangeAnchor(null)
      clampRange(y, value.startMonth, value.endMonth, onChange)
    },
    [onChange, value.endMonth, value.startMonth]
  )

  const onMonthClick = useCallback(
    (month: number) => {
      if (disabled) return
      if (rangeAnchor === null) {
        setRangeAnchor(month)
        clampRange(value.year, month, month, onChange)
        return
      }
      clampRange(value.year, rangeAnchor, month, onChange)
      setRangeAnchor(null)
    },
    [disabled, onChange, rangeAnchor, value.year]
  )

  const inRange = useCallback(
    (m: number) => m >= value.startMonth && m <= value.endMonth,
    [value.endMonth, value.startMonth]
  )

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
        <div className="txn-ym-months" role="group" aria-label="Month range">
          {MONTH_LABELS.map((label, i) => {
            const month = i + 1
            const faded = !(availByMonth.get(month) ?? false)
            const range = inRange(month)
            const edge = month === value.startMonth || month === value.endMonth
            const cls = [
              'txn-ym-month',
              faded ? 'txn-ym-month--faded' : '',
              range ? 'txn-ym-month--in-range' : '',
              edge ? 'txn-ym-month--edge' : ''
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={month}
                type="button"
                className={cls}
                disabled={disabled}
                onClick={() => onMonthClick(month)}
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
