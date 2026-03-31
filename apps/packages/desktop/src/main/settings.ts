import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SETTINGS_FILE = 'moneylooksee-settings.json'

export function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

interface SettingsFile {
  lastCorpusFolder: string | null
}

export function readStoredCorpusFolder(): string | null {
  try {
    const p = getSettingsPath()
    if (!existsSync(p)) return null
    const raw = readFileSync(p, 'utf8')
    const data = JSON.parse(raw) as Partial<SettingsFile>
    if (typeof data.lastCorpusFolder === 'string' && data.lastCorpusFolder.length > 0) {
      return data.lastCorpusFolder
    }
    if (data.lastCorpusFolder === null) return null
    return null
  } catch {
    return null
  }
}

export function writeStoredCorpusFolder(folder: string | null): void {
  const payload: SettingsFile = { lastCorpusFolder: folder }
  writeFileSync(getSettingsPath(), JSON.stringify(payload, null, 2), 'utf8')
}
