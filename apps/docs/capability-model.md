# Capability model

Each runnable surface (eventually each “app”) declares what it is allowed to do. That drives **preload API exposure**, **menu items**, **tests**, and **user-visible mode**.

## Concepts

- **`AppManifest`**: identity and packaging metadata (id, name, version, entry).
- **`AppCapabilityProfile`**: what the surface may do at runtime with respect to the corpus and host.

## Suggested capability flags

| Flag | Meaning |
|------|--------|
| `canReadCorpus` | May open/list/read corpus data via IPC. |
| `canWriteCorpus` | May request mutations (only if backed by shared mutation service). |
| `canRunBulkOperations` | May run bulk classify/update operations (subset of write). |
| `canManageSettings` | May persist host/app settings through the platform. |

## Reader vs editor

- A **reader** profile has `canReadCorpus: true` and `canWriteCorpus: false`. The preload script **must not** expose mutation IPC to the renderer.
- An **editor** profile has `canWriteCorpus: true` (and may set `canRunBulkOperations`). Mutation calls go through **one** validated API surface in main/shared core.

## Implementation

Type definitions live in `libraries/app-contracts`. The `applications/hello` shell imports a manifest for the current build (hello world: **reader-only**).
