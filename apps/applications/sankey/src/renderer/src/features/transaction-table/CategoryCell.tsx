import type { ReactElement } from 'react'
import { CATEGORY_DISPLAY_MAX, truncateDisplay } from './truncateDisplay.js'

export function CategoryCell({ category }: { category: string }): ReactElement {
  const truncated = category.length > CATEGORY_DISPLAY_MAX

  return (
    <td className="txn-table-category">
      <span className="txn-category-preview">{truncateDisplay(category)}</span>
      {truncated ? (
        <span className="txn-desc-tooltip" role="tooltip">
          {category}
        </span>
      ) : null}
    </td>
  )
}
