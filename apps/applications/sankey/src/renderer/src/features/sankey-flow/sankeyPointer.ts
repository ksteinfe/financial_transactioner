/** Convert screen coordinates to layout space inside a section (below title + section offset). */
export function clientToLayoutPoint(
  svg: SVGSVGElement,
  sankeyRoot: SVGGElement,
  layoutOffsetY: number,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const inv = sankeyRoot.getScreenCTM()?.inverse()
  if (!inv) return { x: 0, y: 0 }
  const p = pt.matrixTransform(inv)
  return { x: p.x, y: p.y - layoutOffsetY }
}
