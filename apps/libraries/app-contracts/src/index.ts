/**
 * App manifests and capability profiles — consumed by app shells, preload, and tests.
 */

export interface AppCapabilityProfile {
  canReadCorpus: boolean
  canWriteCorpus: boolean
  canRunBulkOperations: boolean
  canManageSettings: boolean
}

export interface AppManifest {
  id: string
  name: string
  version: string
  capabilities: AppCapabilityProfile
}

/** Default reader-only profile for hello-world / visualization surfaces. */
export const readerCapabilities: AppCapabilityProfile = {
  canReadCorpus: true,
  canWriteCorpus: false,
  canRunBulkOperations: false,
  canManageSettings: true
}
