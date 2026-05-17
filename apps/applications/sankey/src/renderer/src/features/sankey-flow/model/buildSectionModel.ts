import {
  aggregateByCategory,
  aggregateByCategorySplitSign,
  parseCategory,
  type CategoryAggregate
} from '@txn/corpus-core/pure'
import type { CorpusTransaction } from '@txn/types'
import { displayLabelForCategoryNode } from './categoryDisplay.js'
import { formatCurrencyShort } from './formatCurrencyShort.js'
import type { SankeyLinkModel, SankeyNodeModel, SankeySectionId, SankeySectionModel } from './sankeyTypes.js'

const SECTION_LABELS: Record<SankeySectionId, string> = {
  main: 'Main',
  reimbursement: 'Reimbursement',
  transfer: 'Transfer'
}

/** Main uses five columns; reimbursement and transfer use four (no outflow majors). */
function skipMajors(sectionId: SankeySectionId): boolean {
  return sectionId !== 'main'
}

function outflowMinorColumn(sectionId: SankeySectionId): 4 | 5 {
  return skipMajors(sectionId) ? 4 : 5
}

function colorRoleForNode(sectionId: SankeySectionId, kind: SankeyNodeModel['kind']): string {
  const p = `${sectionId}.`
  if (kind === 'deficit') return `${p}deficit`
  if (kind === 'surplus') return `${p}surplus`
  if (kind === 'total-inflow' || kind === 'total-outflow') return `${sectionId === 'main' ? 'main' : sectionId}.total`
  if (kind === 'inflow-minor') return `${sectionId === 'main' ? 'main' : sectionId}.inflow`
  if (kind === 'outflow-major') return `${sectionId === 'main' ? 'main' : sectionId}.outflowMajor`
  if (kind === 'outflow-minor') return `${sectionId === 'main' ? 'main' : sectionId}.outflowMinor`
  return `${p}total`
}

function sortNodesColumn1(a: SankeyNodeModel, b: SankeyNodeModel): number {
  const d = b.sortValue - a.sortValue
  if (d !== 0) return d
  return a.label.localeCompare(b.label)
}

function sortNodesColumn4(a: SankeyNodeModel, b: SankeyNodeModel): number {
  return sortNodesColumn1(a, b)
}

/**
 * Outflow minors: group by major (optionally in column-4 order), then largest $ first within each major.
 */
function sortOutflowMinors(
  nodes: SankeyNodeModel[],
  majorCol4Order?: readonly SankeyNodeModel[]
): SankeyNodeModel[] {
  const byMajor = new Map<string, SankeyNodeModel[]>()
  for (const n of nodes) {
    const m = n.majorCategory ?? ''
    if (!byMajor.has(m)) byMajor.set(m, [])
    byMajor.get(m)!.push(n)
  }

  let majorOrder: string[]
  if (majorCol4Order && majorCol4Order.length > 0) {
    majorOrder = majorCol4Order.map((m) => m.majorCategory ?? m.label)
    for (const k of byMajor.keys()) {
      if (!majorOrder.includes(k)) majorOrder.push(k)
    }
  } else {
    majorOrder = [...byMajor.keys()].sort((a, b) => {
      const ta = byMajor.get(a)!.reduce((s, x) => s + x.magnitude, 0)
      const tb = byMajor.get(b)!.reduce((s, x) => s + x.magnitude, 0)
      return tb - ta
    })
  }

  const out: SankeyNodeModel[] = []
  let stackOrder = 0
  for (const maj of majorOrder) {
    const list = byMajor.get(maj)
    if (!list) continue
    list.sort((a, b) => {
      const d = b.sortValue - a.sortValue
      if (d !== 0) return d
      return a.label.localeCompare(b.label)
    })
    for (const n of list) {
      n.stackOrder = stackOrder
      stackOrder += 1
      out.push(n)
    }
  }
  return out
}

export function collectInflowOutflow(
  sectionId: SankeySectionId,
  transactions: CorpusTransaction[]
): { inflowCats: CategoryAggregate[]; outflowCats: CategoryAggregate[] } | null {
  if (sectionId === 'main') {
    const aggregates = aggregateByCategory(transactions).filter((a) => a.total !== 0)
    if (aggregates.length === 0) return null
    const inflowCats: CategoryAggregate[] = []
    const outflowCats: CategoryAggregate[] = []
    for (const a of aggregates) {
      if (a.total > 0) inflowCats.push(a)
      else if (a.total < 0) outflowCats.push(a)
    }
    return { inflowCats, outflowCats }
  }

  const splits = aggregateByCategorySplitSign(transactions)
  if (splits.length === 0) return null
  const inflowCats: CategoryAggregate[] = []
  const outflowCats: CategoryAggregate[] = []
  for (const s of splits) {
    if (s.inflow > 0) {
      inflowCats.push({ category: s.category, major: s.major, total: s.inflow })
    }
    if (s.outflow > 0) {
      outflowCats.push({ category: s.category, major: s.major, total: -s.outflow })
    }
  }
  if (inflowCats.length === 0 && outflowCats.length === 0) return null
  return { inflowCats, outflowCats }
}

/**
 * Build strict-flow Sankey section from transactions already scoped to this section and date range.
 */
export function buildSectionModel(
  sectionId: SankeySectionId,
  transactions: CorpusTransaction[]
): SankeySectionModel {
  const label = SECTION_LABELS[sectionId]
  const flow = collectInflowOutflow(sectionId, transactions)

  if (!flow) {
    return {
      id: sectionId,
      label,
      nodes: [],
      links: [],
      totalInflow: 0,
      totalOutflow: 0,
      deficit: 0,
      surplus: 0,
      hasActivity: false
    }
  }

  const { inflowCats, outflowCats } = flow
  const noMajors = skipMajors(sectionId)
  const minorCol = outflowMinorColumn(sectionId)

  const totalInflow = inflowCats.reduce((s, a) => s + a.total, 0)
  const totalOutflow = outflowCats.reduce((s, a) => s + Math.abs(a.total), 0)
  const deficit = Math.max(0, totalOutflow - totalInflow)
  const surplus = Math.max(0, totalInflow - totalOutflow)

  const majorTotals = new Map<string, number>()
  for (const a of outflowCats) {
    const { major } = parseCategory(a.category)
    majorTotals.set(major, (majorTotals.get(major) ?? 0) + Math.abs(a.total))
  }

  const links: SankeyLinkModel[] = []
  const nid = (suffix: string) => `${sectionId}|${suffix}`

  const col1: SankeyNodeModel[] = []
  for (const a of inflowCats) {
    const mag = a.total
    const inflowDisplay = displayLabelForCategoryNode(sectionId, 'inflow-minor', 1, a.category)
    col1.push({
      id: nid(`inflow|${a.category}`),
      sectionId,
      column: 1,
      kind: 'inflow-minor',
      label: a.category,
      displayLabel: inflowDisplay === a.category ? undefined : inflowDisplay,
      category: a.category,
      majorCategory: a.major,
      rawSignedValue: a.total,
      magnitude: mag,
      sortValue: mag,
      colorRole: colorRoleForNode(sectionId, 'inflow-minor'),
      formattedValue: formatCurrencyShort(a.total)
    })
  }
  col1.sort(sortNodesColumn1)

  const middle: SankeyNodeModel[] = []
  const hasInflow = totalInflow > 0
  const hasOutflow = totalOutflow > 0
  let totalInflowId: string | null = null
  let totalOutflowId: string | null = null

  if (hasInflow) {
    totalInflowId = nid('total-inflow')
    middle.push({
      id: totalInflowId,
      sectionId,
      column: 2,
      kind: 'total-inflow',
      label: 'total inflow',
      magnitude: totalInflow,
      sortValue: totalInflow,
      colorRole: colorRoleForNode(sectionId, 'total-inflow'),
      formattedValue: formatCurrencyShort(totalInflow)
    })
  }

  const deficitId = deficit > 0 ? nid('deficit') : null
  if (deficitId) {
    middle.push({
      id: deficitId,
      sectionId,
      column: 2,
      kind: 'deficit',
      label: 'deficit',
      magnitude: deficit,
      sortValue: deficit,
      colorRole: colorRoleForNode(sectionId, 'deficit'),
      formattedValue: formatCurrencyShort(deficit)
    })
  }

  if (hasOutflow) {
    totalOutflowId = nid('total-outflow')
    middle.push({
      id: totalOutflowId,
      sectionId,
      column: 3,
      kind: 'total-outflow',
      label: 'total outflow',
      magnitude: totalOutflow,
      sortValue: totalOutflow,
      colorRole: colorRoleForNode(sectionId, 'total-outflow'),
      formattedValue: formatCurrencyShort(totalOutflow)
    })
  }

  const surplusId = surplus > 0 ? nid('surplus') : null
  if (surplusId) {
    middle.push({
      id: surplusId,
      sectionId,
      column: 3,
      kind: 'surplus',
      label: 'surplus',
      magnitude: surplus,
      sortValue: surplus,
      colorRole: colorRoleForNode(sectionId, 'surplus'),
      formattedValue: formatCurrencyShort(surplus)
    })
  }

  const col4: SankeyNodeModel[] = []
  if (!noMajors) {
    for (const [major, tot] of majorTotals) {
      col4.push({
        id: nid(`major|${major}`),
        sectionId,
        column: 4,
        kind: 'outflow-major',
        label: major,
        majorCategory: major,
        magnitude: tot,
        sortValue: tot,
        colorRole: colorRoleForNode(sectionId, 'outflow-major'),
        formattedValue: formatCurrencyShort(tot)
      })
    }
    col4.sort(sortNodesColumn4)
  }

  const outflowMinors: SankeyNodeModel[] = []
  for (const a of outflowCats) {
    const { major } = parseCategory(a.category)
    const mag = Math.abs(a.total)
    const outDisplay = displayLabelForCategoryNode(sectionId, 'outflow-minor', minorCol, a.category)
    outflowMinors.push({
      id: nid(`minor|${a.category}`),
      sectionId,
      column: minorCol,
      kind: 'outflow-minor',
      label: a.category,
      displayLabel: outDisplay === a.category ? undefined : outDisplay,
      category: a.category,
      majorCategory: major,
      rawSignedValue: a.total,
      magnitude: mag,
      sortValue: mag,
      colorRole: colorRoleForNode(sectionId, 'outflow-minor'),
      formattedValue: formatCurrencyShort(mag)
    })
  }
  const outflowSorted = sortOutflowMinors(outflowMinors, noMajors ? undefined : col4)

  const ordered: SankeyNodeModel[] = [...col1, ...middle, ...col4, ...outflowSorted]

  const link = (source: string, target: string, value: number, id: string, colorRole?: string) => {
    if (value <= 0) return
    links.push({
      id: nid(`link|${id}`),
      sectionId,
      source,
      target,
      value,
      colorRole
    })
  }

  for (const n of col1) {
    if (totalInflowId) link(n.id, totalInflowId, n.magnitude, `in|${n.id}`)
  }

  if (deficitId && totalOutflowId) {
    link(deficitId, totalOutflowId, deficit, 'deficit')
  }

  if (totalInflowId && totalOutflowId) {
    if (surplusId) {
      link(totalInflowId, totalOutflowId, totalOutflow, 'bridge')
      link(totalInflowId, surplusId, surplus, 'surplus')
    } else if (deficitId) {
      link(totalInflowId, totalOutflowId, totalInflow, 'bridge')
    } else {
      link(totalInflowId, totalOutflowId, totalInflow, 'bridge')
    }
  } else if (totalInflowId && surplusId) {
    link(totalInflowId, surplusId, surplus, 'surplus')
  }

  if (!noMajors && totalOutflowId) {
    for (const m of col4) {
      link(totalOutflowId, m.id, m.magnitude, `to-major|${m.id}`)
    }
  }

  const majorIds = new Set(col4.map((m) => m.id))
  for (const n of outflowSorted) {
    if (noMajors && totalOutflowId) {
      link(totalOutflowId, n.id, n.magnitude, `to-minor|${n.id}`)
    } else if (!noMajors) {
      const majId = nid(`major|${n.majorCategory ?? ''}`)
      if (majorIds.has(majId)) link(majId, n.id, n.magnitude, `maj-min|${n.id}`)
    }
  }

  return {
    id: sectionId,
    label,
    nodes: ordered,
    links,
    totalInflow,
    totalOutflow,
    deficit,
    surplus,
    hasActivity: true
  }
}
