import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name (required for icon-only buttons). */
  label: string
  icon: ReactNode
  /** Visual pressed state (e.g. filter row visible). */
  pressed?: boolean
}

/**
 * Standard square icon control: 28×28px hit target, 16×16px icon.
 * Pair with components from `./icons/TxnIcons.tsx`.
 */
export function IconButton({
  label,
  icon,
  pressed = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps): ReactElement {
  const classes = ['txn-icon-btn', pressed ? 'txn-icon-btn-pressed' : null, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes || undefined}
      aria-label={label}
      title={label}
      aria-pressed={pressed ? true : undefined}
      {...rest}
    >
      <span className="txn-icon-btn__icon">{icon}</span>
    </button>
  )
}
