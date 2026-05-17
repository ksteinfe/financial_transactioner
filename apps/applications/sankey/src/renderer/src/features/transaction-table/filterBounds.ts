import { parseCategory } from '@txn/corpus-core/pure'
import type { CorpusTransaction } from '@txn/types'

export interface DateBounds {
  min: string
  max: string
}

export interface AmountBounds {
  min: number
  max: number
}

export interface CategoryGroup {
  major: string
  items: { path: string; minor: string }[]
}

export interface TransactionFilterBounds {
  date: DateBounds
  amount: AmountBounds
  accounts: string[]
  categoryGroups: CategoryGroup[]
  allCategoryPaths: string[]
}

export function computeFilterBounds(transactions: CorpusTransaction[]): TransactionFilterBounds {
  if (transactions.length === 0) {
    return {
      date: { min: '', max: '' },
      amount: { min: 0, max: 0 },
      accounts: [],
      categoryGroups: [],
      allCategoryPaths: []
    }
  }

  let dateMin = ''
  let dateMax = ''
  let amountMin = 0
  let amountMax = 0
  const accountSet = new Set<string>()
  const byMajor = new Map<string, Map<string, string>>()

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]
    if (!dateMin || tx.date < dateMin) dateMin = tx.date
    if (!dateMax || tx.date > dateMax) dateMax = tx.date
    if (i === 0) {
      amountMin = tx.amount
      amountMax = tx.amount
    } else {
      if (tx.amount < amountMin) amountMin = tx.amount
      if (tx.amount > amountMax) amountMax = tx.amount
    }
    accountSet.add(tx.account)
    const { major, minor } = parseCategory(tx.category)
    if (!byMajor.has(major)) byMajor.set(major, new Map())
    byMajor.get(major)!.set(tx.category, minor)
  }

  const accounts = [...accountSet].sort((a, b) => a.localeCompare(b))
  const categoryGroups: CategoryGroup[] = [...byMajor.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((major) => {
      const minors = byMajor.get(major)!
      const items = [...minors.entries()]
        .map(([path, minor]) => ({ path, minor }))
        .sort((a, b) => a.minor.localeCompare(b.minor))
      return { major, items }
    })

  const allCategoryPaths = categoryGroups.flatMap((g) => g.items.map((i) => i.path))

  return {
    date: { min: dateMin, max: dateMax },
    amount: { min: amountMin, max: amountMax },
    accounts,
    categoryGroups,
    allCategoryPaths
  }
}
