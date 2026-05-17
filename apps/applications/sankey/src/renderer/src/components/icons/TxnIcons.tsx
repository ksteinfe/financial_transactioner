import type { SVGAttributes } from 'react'
import filterSvg from '../../assets/icons/icon-filter.svg?raw'
import copyJsonSvg from '../../assets/icons/icon-copy-json.svg?raw'
import downloadCsvSvg from '../../assets/icons/icon-download-csv.svg?raw'
import { SvgIconFromAsset, type SvgIconFromAssetProps } from './SvgIconFromAsset.js'

export type TxnIconProps = Omit<SvgIconFromAssetProps, 'svg'>

/** `assets/icons/icon-filter.svg` */
export function IconFilter(props: TxnIconProps) {
  return <SvgIconFromAsset svg={filterSvg} {...props} />
}

/** `assets/icons/icon-copy-json.svg` */
export function IconCopyJson(props: TxnIconProps) {
  return <SvgIconFromAsset svg={copyJsonSvg} {...props} />
}

/** `assets/icons/icon-download-csv.svg` */
export function IconDownloadCsv(props: TxnIconProps) {
  return <SvgIconFromAsset svg={downloadCsvSvg} {...props} />
}

// Re-export for consumers that need the raw markup
export { filterSvg, copyJsonSvg, downloadCsvSvg }
