export type SankeySectionId = 'main' | 'reimbursement' | 'transfer'

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
  label: string
  majorCategory?: string
  category?: string
  rawSignedValue?: number
  magnitude: number
  sortValue: number
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
