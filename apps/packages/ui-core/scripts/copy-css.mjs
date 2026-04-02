import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
copyFileSync(join(root, '../src/styles.css'), join(root, '../dist/styles.css'))
