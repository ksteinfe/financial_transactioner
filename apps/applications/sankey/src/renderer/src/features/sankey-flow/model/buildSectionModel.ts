import { aggregateByCategory, parseCategory, type CategoryAggregate } from '@txn/corpus-core/pure'
import type { CorpusTransaction } from '@txn/types'
import { formatCurrencyShort } from './formatCurrencyShort.js'
import type { SankeyLinkModel, SankeyNodeModel, SankeySectionId, SankeySectionModel } from './sankeyTypes.js'

const SECTION_LABELS: Record<SankeySectionId, string> = {
  main: 'Main',
  reimbursement: 'Reimbursement',
  transfer: 'Transfer'
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

function sortNodesColumn5(nodes: SankeyNodeModel[]): SankeyNodeModel[] {
  const byMajor = new Map<string, SankeyNodeModel[]>()
  for (const n of nodes) {
    const m = n.majorCategory ?? ''
    if (!byMajor.has(m)) byMajor.set(m, [])
    byMajor.get(m)!.push(n)
  }
  const majorOrder = [...byMajor.keys()].sort((a, b) => {
    const ta = byMajor.get(a)!.reduce((s, x) => s + x.magnitude, 0)
    const tb = byMajor.get(b)!.reduce((s, x) => s + x.magnitude, 0)
    return tb - ta
  })
  const out: SankeyNodeModel[] = []
  for (const maj of majorOrder) {
    const list = byMajor.get(maj)!
    list.sort((a, b) => {
      const d = b.sortValue - a.sortValue
      if (d !== 0) return d
      return a.label.localeCompare(b.label)
    })
    out.push(...list)
  }
  return out
}

/**
 * Build strict-flow Sankey section from transactions already scoped to this section and date range.
 */
export function buildSectionModel(
  sectionId: SankeySectionId,
  transactions: CorpusTransaction[]
): SankeySectionModel {
  const label = SECTION_LABELS[sectionId]
  const aggregates = aggregateByCategory(transactions).filter((a) => a.total !== 0)

  if (aggregates.length === 0) {
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

  const inflowCats: CategoryAggregate[] = []
  const outflowCats: CategoryAggregate[] = []
  for (const a of aggregates) {
    if (a.total > 0) inflowCats.push(a)
    else if (a.total < 0) outflowCats.push(a)
  }

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
  /** Transfer section: column 1 → total inflow → total outflow → minors only (no major category column). */
  const skipMajors = sectionId === 'transfer'

  const nid = (suffix: string) => `${sectionId}|${suffix}`

  const col1: SankeyNodeModel[] = []
  for (const a of inflowCats) {
    const mag = a.total
    col1.push({
      id: nid(`inflow|${a.category}`),
      sectionId,
      column: 1,
      kind: 'inflow-minor',
      label: a.category,
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

  middle.push({
    id: nid('total-inflow'),
    sectionId,
    column: 2,
    kind: 'total-inflow',
    label: 'Total inflow',
    magnitude: Math.max(totalInflow, totalOutflow),
    sortValue: Math.max(totalInflow, totalOutflow),
    colorRole: colorRoleForNode(sectionId, 'total-inflow'),
    formattedValue: formatCurrencyShort(totalInflow)
  })

  if (deficit > 0) {
    middle.push({
      id: nid('deficit'),
      sectionId,
      column: 2,
      kind: 'deficit',
      label: 'Deficit',
      magnitude: deficit,
      sortValue: deficit,
      colorRole: colorRoleForNode(sectionId, 'deficit'),
      formattedValue: formatCurrencyShort(deficit)
    })
  }

  middle.push({
    id: nid('total-outflow'),
    sectionId,
    column: 3,
    kind: 'total-outflow',
    label: 'Total outflow',
    magnitude: Math.max(totalInflow, totalOutflow),
    sortValue: Math.max(totalInflow, totalOutflow),
    colorRole: colorRoleForNode(sectionId, 'total-outflow'),
    formattedValue: formatCurrencyShort(totalOutflow)
  })

  if (surplus > 0) {
    middle.push({
      id: nid('surplus'),
      sectionId,
      column: 3,
      kind: 'surplus',
      label: 'Surplus',
      magnitude: surplus,
      sortValue: surplus,
      colorRole: colorRoleForNode(sectionId, 'surplus'),
      formattedValue: formatCurrencyShort(surplus)
    })
  }

  const col4: SankeyNodeModel[] = []
  if (!skipMajors) {
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

  const col5: SankeyNodeModel[] = []
  for (const a of outflowCats) {
    const { major } = parseCategory(a.category)
    const mag = Math.abs(a.total)
    col5.push({
      id: nid(`minor|${a.category}`),
      sectionId,
      column: 5,
      kind: 'outflow-minor',
      label: a.category,
      category: a.category,
      majorCategory: major,
      rawSignedValue: a.total,
      magnitude: mag,
      sortValue: mag,
      colorRole: colorRoleForNode(sectionId, 'outflow-minor'),
      formattedValue: formatCurrencyShort(mag)
    })
  }
  const col5sorted = sortNodesColumn5(col5)

  const ordered: SankeyNodeModel[] = [...col1, ...middle, ...col4, ...col5sorted]

  const bridge = Math.max(totalInflow, totalOutflow)

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

  const totalInflowId = nid('total-inflow')
  const totalOutflowId = nid('total-outflow')

  for (const n of col1) {
    link(n.id, totalInflowId, n.magnitude, `in|${n.id}`)
  }
  if (deficit > 0) {
    link(nid('deficit'), totalInflowId, deficit, 'deficit')
  }
  link(totalInflowId, totalOutflowId, bridge, 'bridge')

  if (surplus > 0) {
    link(totalOutflowId, nid('surplus'), surplus, 'surplus')
  }

  if (!skipMajors) {
    for (const m of col4) {
      link(totalOutflowId, m.id, m.magnitude, `to-major|${m.id}`)
    }
  }

  for (const n of col5sorted) {
    if (skipMajors) {
      link(totalOutflowId, n.id, n.magnitude, `to-minor|${n.id}`)
    } else {
      const majId = nid(`major|${n.majorCategory ?? ''}`)
      link(majId, n.id, n.magnitude, `maj-min|${n.id}`)
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
