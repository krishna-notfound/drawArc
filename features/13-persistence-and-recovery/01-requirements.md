# F13 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The system shall add `@vercel/blob` `^2.8.2` and validate `BLOB_READ_WRITE_TOKEN` (optional; required when `VERCEL !== '1'`, i.e. local/CI; OIDC on Vercel) in `lib/env.ts`. | must | D-009, NFR-008 | AC-001 |
| FR-002 | `lib/blob.ts` shall export `canvasPathname(projectId)` = `canvas/${projectId}.json`, `putCanvas(projectId, doc)` using `put(pathname, JSON.stringify(doc), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' })`, `getCanvas(projectId)` using `get(pathname, { access: 'private', useCache: false })` returning parsed JSON (`unknown`) or `null` when missing, and `deleteCanvas(projectId)`; pathnames are never derived from user input. | must | D-009, D-022, security-model | AC-002, AC-003 |
| FR-003 | `PUT /api/projects/[projectId]/canvas` shall, in order: `requireProjectRole(projectId, 'editor')`; reject bodies > 4 MB (422); parse `{ document: unknown; allowEmpty?: boolean }` (400 on malformed envelope); `migrate` then `validateDocument` (422 with issues on failure; caps 2,000/4,000 enforced by the schema); reject an empty document over an existing snapshot without `allowEmpty` (409); enforce the 10 s minimum interval (429 + `Retry-After`); `putCanvas`; then update `Project.canvasBlobPath/canvasSavedAt/canvasSchemaVersion`; respond 200 `{ savedAt, schemaVersion, size, pointerUpdated }`. | must | PRD-033, NFR-001, NFR-002, security-model | AC-004–AC-009 |
| FR-004 | `GET /api/projects/[projectId]/canvas` shall `requireProjectRole(projectId, 'viewer')`, read the blob by deterministic pathname, parse, `migrate` to the current `schemaVersion`, `validateDocument`, and respond 200 `{ document, savedAt }` (`document: null` when no blob; `warning: 'SNAPSHOT_INVALID'` with `document: null` when the stored JSON is unparseable or invalid after migration), with `Cache-Control: no-store`; blob URLs never appear in any response. | must | PRD-034, data-ownership rule 8 | AC-010–AC-012 |
| FR-005 | `hooks/useAutosave` shall, for owners/editors only, subscribe to node/edge changes (React Flow store subscription, no re-render), mark `dirty`, and save ≥ 30 s after the last change with a 60 s maximum wait from the first unsaved change; it shall skip the upload when the serialised document equals the last saved one. `snapshotExists`/`savedAt` are received from the server gate's seed result (`SeedResult`, FR-010) as props — the client issues no GET on mount. | must | PRD-033, NFR-005, D-009, D-034 | AC-013, AC-014 |
| FR-006 | `useAutosave` shall flush immediately on `visibilitychange` → `hidden` (normal fetch) and on `pagehide` (keepalive fetch when body ≤ 60 KB, else best-effort normal fetch). | must | D-009, P-13-5 | AC-015 |
| FR-007 | `useAutosave` shall expose `status ∈ { idle, dirty, saving, saved, error, readonly }`, `lastSavedAt`, `lastError`, and `save({ allowEmpty? })`; 429 shall reschedule (status stays `dirty`), 409-empty shall set `idle` without error, 403 shall set `readonly` and stop autosave, 5xx/network shall set `error` and retry at 10 s, 20 s, 40 s then wait for the next change. | must | PRD-033 | AC-016, AC-017 |
| FR-008 | The autosave shall never upload a document with 0 nodes and 0 edges while `snapshotExists` (known from GET or a previous save); a manual Save of an empty canvas shall open a confirmation dialog and, on confirm, call `save({ allowEmpty: true })`. | must | P-13-1 | AC-018 |
| FR-009 | `components/editor/save-button.tsx` in the workspace navbar shall show "Save" (idle/dirty), "Saving…", "Saved · HH:MM" (for 3 s, then "Saved"), "Error · Retry"; clicking calls the same `save` function; hidden for viewers; always text + icon. | must | PRD-033, reference bug §1 | AC-019 |
| FR-010 | `lib/liveblocks-flow.ts` shall export `seedRoomIfEmpty({ id, canvasBlobPath, canvasSchemaVersion }): Promise<SeedResult>`, called by the F04 workspace gate after `requireProjectRole` and before rendering (any role, D-034): when `canvasBlobPath` is `null` → `{ seeded: false, snapshotExists: false }` with no Liveblocks call; else `getStorageDocument(projectId, 'json')` → if the `flow` key has ≥ 1 node or ≥ 1 edge → `{ seeded: false, snapshotExists: true }` (a non-empty room is never overwritten); else `getCanvas` → `migrate` → `validateDocument` → one `mutateFlow({ client, roomId: projectId, storageKey: 'flow' }, flow => { nodes.forEach(flow.addNode); edges.forEach(flow.addEdge) })` callback containing no `await` → `{ seeded: true, snapshotExists: true, savedAt }`. It shall broadcast no room event and never throw. | must | PRD-033, data-ownership rule 3, invariant 6, D-034 | AC-020, AC-021, AC-022 |
| FR-011 | (withdrawn — D-034) Client-side concurrent seeding no longer exists. Two concurrent workspace opens of the same empty room are covered by FR-010's idempotence: both gates may seed, but ids are stable and `mutateFlow.addNode` with an existing id replaces rather than duplicates, so the room converges to exactly one copy. | — | D-034 | AC-030 |
| FR-012 | (withdrawn — D-034) Viewers no longer see a notice; the server seeds the room regardless of the opener's role, so a viewer opening an empty room with a snapshot sees the diagram. | — | D-034 | AC-031 |
| FR-013 | Migration fixtures shall exist as `tests/fixtures/canvas/v{n}-*.json` for every schema version ≤ current, and GET shall return `schemaVersion` = current for each when stored. | must | PRD-034 | AC-025 |
| FR-014 | `deleteCanvas(projectId)` shall be called by the F03 delete-project action after the Postgres cascade (best effort, logged). | should | invariant 7 | AC-026 |
| FR-015 | The `storageUpdated` webhook shall remain log-only (F05); this feature documents the backstop as deferred (P-13-6) and adds no server-side save path. | must | R-08 | AC-027 |
| FR-016 | When `getStorageDocument`, `getCanvas` or `mutateFlow` rejects during `seedRoomIfEmpty`, the function shall return `{ seeded: false, snapshotExists: true, warning: 'SEED_FAILED' }` after logging at `error` level with `{ projectId, userId, requestId, step }`; when the stored snapshot is unparseable or invalid after migration it shall return `warning: 'SNAPSHOT_INVALID'` (no mutation). The gate still renders the workspace; `components/canvas/seed-warning-banner.tsx` shows "The saved diagram couldn't be restored right now. It will be retried the next time this project is opened." for `SEED_FAILED` and "The saved diagram could not be restored (invalid snapshot)." for `SNAPSHOT_INVALID` (dismissible, `role="status"`). The next open re-runs the seed because the room is still empty. | must | P-13-8, D-034 | AC-029 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-001 | Both routes call `requireProjectRole`; `projectId` from the URL is only its argument. |
| NFR-002 | Body envelope and document validated with Zod (same `CanvasDocumentSchema` as F06); stored JSON re-validated on read. |
| NFR-003 | Seed adds to the gate's server time: one `getStorageDocument` per open (always, when a snapshot exists) plus `getCanvas` + `mutateFlow` only when the room is empty — ≤ 1 s for `small-5-nodes`; measured in TC-017 (unit, mocked clients) and TC-019 (E2E, server timing logged). |
| NFR-004 | Caps 2,000/4,000 and 4 MB keep room storage < 5 MB. |
| NFR-005 | 30 s debounce / 60 s max-wait + unload flush; E2E reload tests. |
| NFR-008 | Blob token server-only; OIDC on Vercel. |
| NFR-009 | Every route error logged with `projectId`, `userId`, `requestId`. |

## UX and interaction behaviour

| State | Save button | Notes |
|---|---|---|
| idle / dirty | `Save` (icon `Save`) | dirty adds a subtle dot; tooltip "Autosaves 30 s after your last change" |
| saving | `Saving…` (spinner) | disabled |
| saved | `Saved · 14:02` → after 3 s `Saved` | tooltip shows full timestamp |
| error | `Error · Retry` (icon `AlertCircle`, `text-error`) | click retries immediately |
| readonly | hidden | viewers; or editor downgraded until reload (F05) |

Empty-canvas confirm dialog: title "Save an empty canvas?", description "This replaces the last saved diagram for everyone.", actions "Cancel" / destructive "Save empty". Seed-warning banner (FR-016): muted banner at top-centre over the canvas, `role="status"`, dismissible; absent when `warning` is `null`. Seeding indicator: none — seeding completes server-side before the page streams (the F04 `WorkspaceSkeleton` covers the wait).

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Blob `put` fails (quota, network) | 502 `UPSTREAM`; pointer untouched; client `error` + backoff | AC-008 |
| EC-002 | `put` succeeds, Postgres pointer update fails (R-04) | 200 `pointerUpdated: false`; logged; GET still works via pathname (P-13-4); `savedAt` stale | AC-009 |
| EC-003 | Body > 4 MB (or Vercel's 4.5 MB limit hits first with its own 413) | 422 `VALIDATION`; client shows error "Diagram too large to save" and stops retrying | AC-005 |
| EC-004 | > 2,000 nodes or > 4,000 edges | 422 with `too_big` issue | AC-005 |
| EC-005 | Two editors autosave within 10 s | second gets 429; reschedules at `Retry-After`; no error UI | AC-007, AC-016 |
| EC-006 | Client sees an empty room because Storage is not yet loaded | irrelevant to seeding (server-side, before render); autosave arms only after suspense resolves and ignores its first subscription tick (no dirty on mount) | AC-013 |
| EC-007 | Empty document over existing snapshot (autosave) | not sent; manual → confirm → `allowEmpty` | AC-018 |
| EC-008 | Snapshot JSON corrupt / invalid after migration | GET: `document: null, warning: 'SNAPSHOT_INVALID'`; seed: `warning: 'SNAPSHOT_INVALID'`, banner shown, nothing written; `snapshotExists = true` (guards P-13-1) | AC-012, AC-029 |
| EC-009 | Snapshot `schemaVersion` newer than the app | migration no-op → validation fails → treated as EC-008 with message "newer app version required" | AC-012, AC-029 |
| EC-010 | Room non-empty at gate time (another member opened earlier, or users added nodes) | `seedRoomIfEmpty` returns `seeded: false`; nothing written; no duplicates | AC-021, AC-030 |
| EC-011 | Tab closed with a 2 MB dirty document | keepalive skipped (> 60 KB); `visibilitychange` flush already ran when the tab was hidden; `beforeunload` guard (F05) prompts if still unsynced | AC-015 |
| EC-012 | Editor downgraded to viewer mid-session before reload | PUT 403 → `readonly`; F05 reload follows | AC-017 |
| EC-013 | Non-member/unauthenticated calls either route | 401 / 403 (identical 403 for missing project) | AC-004, AC-010 |
| EC-014 | Project deleted while PUT in flight | 403 (role lookup fails); logged | AC-004 |
| EC-015 | Seed on a room with a snapshot of 500 nodes | one synchronous `mutateFlow` callback; gate adds < 1 s server time; no client undo entry exists because the write is remote-origin | AC-020 |
| EC-016 | Liveblocks REST unreachable at open (`getStorageDocument`/`mutateFlow` reject) | `warning: 'SEED_FAILED'`; workspace renders unseeded with the banner; error logged; the next open retries automatically (room still empty, snapshot still set) | AC-029 |
| EC-017 | Two members open the same empty room within the same second (two gates seed) | both `mutateFlow` passes add the same ids; `addNode` with an existing id replaces; exactly one copy results; no error | AC-030 |
