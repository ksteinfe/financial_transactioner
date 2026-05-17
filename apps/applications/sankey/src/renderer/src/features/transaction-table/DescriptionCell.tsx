import type { ReactElement } from 'react'

const PREVIEW_LEN = 10

function previewText(text: string): string {
  if (text.length <= PREVIEW_LEN) return text
  return `${text.slice(0, PREVIEW_LEN)}...`
}

export function DescriptionCell({ text }: { text: string }): ReactElement {
  const truncated = text.length > PREVIEW_LEN

  return (
    <td className="txn-table-description">
      <span className="txn-desc-preview">{previewText(text)}</span>
      {truncated ? (
        <span className="txn-desc-tooltip" role="tooltip">
          {text}
        </span>
      ) : null}
    </td>
  )
}
