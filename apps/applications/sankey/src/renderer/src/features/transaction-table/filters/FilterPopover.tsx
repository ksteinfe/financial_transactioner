import {
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode
} from 'react'

export interface FilterPopoverProps {
  title: string
  onClose: () => void
  /** Enter in the popover applies the filter and closes. */
  onSubmit?: () => void
  /** Clicks inside this node do not close the popover (e.g. column header with filter button). */
  ignoreCloseWithin?: HTMLElement | null
  children: ReactNode
}

export function FilterPopover({
  title,
  onClose,
  onSubmit,
  ignoreCloseWithin,
  children
}: FilterPopoverProps): ReactElement {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = panelRef.current
      if (!el) return
      const target = e.target
      if (!(target instanceof Node)) return
      if (el.contains(target)) return
      if (ignoreCloseWithin?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onClose, ignoreCloseWithin])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit?.()
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter' || !onSubmit) return
    const target = e.target
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div ref={panelRef} className="txn-filter-popover" role="dialog" aria-label={title}>
      <form className="txn-filter-popover__form" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <div className="txn-filter-popover__title">{title}</div>
        {children}
      </form>
    </div>
  )
}

export function FilterPopoverActions({ onClear }: { onClear: () => void }): ReactElement {
  return (
    <div className="txn-filter-popover__actions">
      <button type="button" className="txn-filter-popover__clear" onClick={onClear}>
        Clear
      </button>
      <button type="submit" className="txn-filter-popover__apply">
        Apply
      </button>
    </div>
  )
}
