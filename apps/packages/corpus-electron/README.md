# `corpus-electron` (reserved)

Bridges **main-process** filesystem and IPC to **corpus-core** abstractions: `openCorpusFolder`, `listAvailableYears`, `readYearFile`, optional `watchCorpus`, and coordination for editor writes.

Not to be confused with renderer code — no direct corpus parsing in the preload beyond typed IPC.
