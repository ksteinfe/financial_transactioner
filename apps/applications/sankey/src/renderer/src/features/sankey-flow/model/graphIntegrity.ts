import type { SankeyLinkModel, SankeyNodeModel } from './sankeyTypes.js'

export interface IntegrityResult {
  ok: boolean
  errors: string[]
}

/**
 * Verify flow conservation for strict-flow Sankey section (spec §9.9).
 */
export function verifySectionIntegrity(
  sectionLabel: string,
  nodes: SankeyNodeModel[],
  links: SankeyLinkModel[]
): IntegrityResult {
  const errors: string[] = []
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  for (const l of links) {
    incoming.set(l.target, (incoming.get(l.target) ?? 0) + l.value)
    outgoing.set(l.source, (outgoing.get(l.source) ?? 0) + l.value)
  }

  const totalInflowNode = nodes.find((n) => n.kind === 'total-inflow')
  const totalOutflowNode = nodes.find((n) => n.kind === 'total-outflow')

  if (totalInflowNode) {
    const inc = incoming.get(totalInflowNode.id) ?? 0
    const out = outgoing.get(totalInflowNode.id) ?? 0
    if (Math.abs(inc - out) > 0.01) {
      errors.push(
        `${sectionLabel}: total inflow node imbalance (in ${inc.toFixed(2)} vs out ${out.toFixed(2)})`
      )
    }
  }

  if (totalOutflowNode) {
    const inc = incoming.get(totalOutflowNode.id) ?? 0
    const out = outgoing.get(totalOutflowNode.id) ?? 0
    if (Math.abs(inc - out) > 0.01) {
      errors.push(
        `${sectionLabel}: total outflow node imbalance (in ${inc.toFixed(2)} vs out ${out.toFixed(2)})`
      )
    }
  }

  for (const n of nodes) {
    if (n.kind !== 'outflow-major') continue
    const inc = incoming.get(n.id) ?? 0
    const out = outgoing.get(n.id) ?? 0
    if (Math.abs(inc - out) > 0.01) {
      errors.push(
        `${sectionLabel}: major "${n.label}" imbalance (in ${inc.toFixed(2)} vs out ${out.toFixed(2)})`
      )
    }
  }

  for (const l of links) {
    if (!byId.has(l.source)) errors.push(`${sectionLabel}: missing source node for link ${l.id}`)
    if (!byId.has(l.target)) errors.push(`${sectionLabel}: missing target node for link ${l.id}`)
  }

  return { ok: errors.length === 0, errors }
}
