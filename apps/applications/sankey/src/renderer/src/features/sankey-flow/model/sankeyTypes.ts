export type SankeySectionId = 'main' | 'reimbursement' | 'transfer'

/** Vertical stack order on the canvas (top → bottom). */
export const SANKEY_SECTION_DISPLAY_ORDER: readonly SankeySectionId[] = [
  'main',
  'transfer',
  'reimbursement'
]

export type SankeyNodeKind =
  | 'inflow-minor'
  | 'total-inflow'
  | 'deficit'
  | 'total-outflow'
  | 'surplus'
  | 'outflow-major'
  | 'outflow-minor'

export interface SankeyDiagramModel {
  selectedYear: number
  selectedStartMonth: number
  selectedEndMonth: number
  sections: SankeySectionModel[]
  integrityErrors: string[]
}

export interface SankeySectionModel {
  id: SankeySectionId
  label: string
  nodes: SankeyNodeModel[]
  links: SankeyLinkModel[]
  totalInflow: number
  totalOutflow: number
  deficit: number
  surplus: number
  /** False when there is no activity in range for this section */
  hasActivity: boolean
}

export interface SankeyNodeModel {
  id: string
  sectionId: SankeySectionId
  column: 1 | 2 | 3 | 4 | 5
  kind: SankeyNodeKind
  /** Full name (category path or semantic label); used in tooltips and link hover. */
  label: string
  /** Shorter on-chart label when different from {@link label}. */
  displayLabel?: string
  majorCategory?: string
  category?: string
  rawSignedValue?: number
  magnitude: number
  sortValue: number
  /** Vertical stack order within a column (set for ordered outflow minors). */
  stackOrder?: number
  colorRole: string
  formattedValue: string
}

export interface SankeyLinkModel {
  id: string
  sectionId: SankeySectionId
  source: string
  target: string
  value: number
  colorRole?: string
}
