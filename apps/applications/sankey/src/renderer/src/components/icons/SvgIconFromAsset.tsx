import { useMemo, type HTMLAttributes, type ReactElement } from 'react'
import { normalizeAssetSvg } from './normalizeAssetSvg.js'

export interface SvgIconFromAssetProps extends HTMLAttributes<HTMLSpanElement> {
  /** Raw SVG markup from `import icon from '...svg?raw'` */
  svg: string
}

/** Renders an SVG asset file; viewBox comes from the file, size from CSS. */
export function SvgIconFromAsset({ svg, className, ...rest }: SvgIconFromAssetProps): ReactElement {
  const html = useMemo(() => normalizeAssetSvg(svg), [svg])
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} {...rest} />
}
