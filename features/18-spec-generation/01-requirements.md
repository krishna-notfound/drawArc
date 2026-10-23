# F18 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | `POST /api/ai/spec` shall: `requireUser` → Zod body `{ projectId: cuid, includeChat?: boolean (default true) }` (400) → `requireProjectRole(projectId, 'editor')` (403 viewer/non-member, identical bodies) → F17 rate limit (≤ 10 runs/user/hour, all kinds; 429) → F17 active-run check (any kind; 409) → create `TaskRun { kind: 'SPEC' }` → `tasks.trigger('generate-spec', { taskRunId, projectId, requestedById, includeChat }, { idempotencyKey: taskRun.id, concurrencyKey: projectId })` → 201 `{ runId, publicToken }` (token scoped to the run, 1 h, via F17 `createRunToken`). The body shall not accept nodes, edges or chat content. | must | PRD-060, NFR-001, F18-D1 | AC-001, AC-002, AC-003 |
| FR-002 | The Prisma schema shall gain `ProjectSpec` per domain-model.md (`id`, `projectId` cascade, `taskRunId?`, `title`, `blobPath`, `createdById`, `createdAt`) plus `sizeBytes Int` and index `(projectId, createdAt)`, delivered as a migration requiring **separate authorization**. | must | PRD-061 | AC-004 |
| FR-003 | `trigger/generate-spec.ts` shall be a `schemaTask` (`id: 'generate-spec'`, `retry.maxAttempts: 1`, `concurrency: { perKey: 1 }`, `maxDuration: 300`) that verifies the `TaskRun` exactly as F17/FR-007 (exists, `kind === 'SPEC'`, project matches, requester still owner/editor) and aborts with `UNAUTHORIZED_RUN` otherwise. | must | NFR-001 | AC-005 |
| FR-004 | The task shall read the graph via F17 `readFlow(projectId)` and never from the payload; when the graph has 0 nodes it fails with `EMPTY_GRAPH`; when it has > 300 nodes or > 600 edges it fails with `GRAPH_TOO_LARGE` (F18-D4); both are reported to chat and nothing is stored. | must | PRD-060, F18-D1, F18-D4 | AC-006 |
| FR-005 | When `includeChat` is true the task shall read the last 50 chat messages (content truncated to 500 chars) from the F16 transport; the `SpecWriterInput` is `{ project: { name, description }, graph: CanvasDocument, chat?: ChatMessage[], generatedAt }` validated by `SpecWriterInputSchema`. | must | PRD-060 | AC-007 |
| FR-006 | The task shall call `writeSpec(input, { signal, runId }): Promise<string>` (provider-agnostic; `FakeSpecWriter` when `AI_PROVIDER=fake`) with a 120 s abort, and validate the result: string, trimmed length ≥ 200 and ≤ 524,288 bytes UTF-8, first non-blank line starts with `# `; otherwise fail `INVALID_SPEC` (one retry with the validation message appended, then fail). | must | NFR-002, F18-D4 | AC-008, AC-009 |
| FR-007 | The task shall generate `specId = cuid()` before upload, upload with `put('specs/{projectId}/{specId}.md', markdown, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'text/markdown; charset=utf-8' })`, and only after a successful `put` create `ProjectSpec { id: specId, projectId, taskRunId, title, blobPath, createdById: requestedById, sizeBytes }`. `title = \`${project.name} — Spec ${YYYY-MM-DD HH:mm}\`` (UTC). | must | PRD-061, D-009 | AC-010, AC-011 |
| FR-008 | If the row insert fails after a successful `put`, the task shall attempt `del` of the uploaded blob once, log at error level `{ runId, projectId, userId, blobPath, deleted: boolean }`, and fail with `STORE_ERROR`; a periodic orphan sweep is explicitly a future task. | must | EC-003 | AC-012 |
| FR-009 | Status and reporting shall reuse F17's helpers: `AiStatus { kind: 'SPEC' }` texts `Starting…`, `Reading the diagram…`, `Writing the spec…`, `Saving…`, idle; `metadata.set('progress', …)`; on success an assistant chat message "Spec ready: <title>" and `TaskRun.status SUCCEEDED`; on failure the F17 `onFailure` behaviour with reasons `EMPTY_GRAPH`, `GRAPH_TOO_LARGE`, `INVALID_SPEC`, `WRITER_ERROR`, `STORE_ERROR`, `UNAUTHORIZED_RUN`. | must | PRD-060 | AC-013, AC-014 |
| FR-010 | `GET /api/projects/[projectId]/specs` shall require `requireProjectRole(projectId, 'viewer')` and return 200 `{ specs: [{ id, title, createdAt, sizeBytes, createdBy: { name } }] }` ordered by `createdAt desc`, limit 50, scoped by `projectId`; `blobPath` is never included. | must | PRD-061 | AC-015, AC-016 |
| FR-011 | `GET /api/projects/[projectId]/specs/[specId]` shall require viewer+, load the spec by `{ id: specId, projectId }` (404 when either does not match), read the blob via `lib/blob.ts` `getSpec(blobPath)` (`get(pathname, { access: 'private' })`), and return 200 `{ id, title, createdAt, content }`; a missing blob returns 404 `NOT_FOUND` and logs `{ specId, blobPath }`. | must | PRD-061 | AC-016, AC-017 |
| FR-012 | `GET /api/projects/[projectId]/specs/[specId]/download` shall apply the same checks and stream the blob with `Content-Type: text/markdown; charset=utf-8`, `Content-Disposition: attachment; filename="<slug(title)>.md"` (ASCII slug ≤ 80 chars, plus `filename*` UTF-8 form), `Cache-Control: private, no-store`. | must | PRD-061 | AC-016, AC-018 |
| FR-013 | The Specs tab (replacing the F16 placeholder) shall show: a "Generate spec" button (editors/owners only; disabled while any run is active, with a spinner during a SPEC run; hidden for viewers), an "Include recent chat" checkbox (default on), the list from FR-010 (title, relative `createdAt`, size, author; newest first; empty state "No specs yet"), a "Preview" action per row, and a "Download" action per row. | must | PRD-061, PRD-055 | AC-019, AC-020 |
| FR-014 | Preview shall open a shadcn `Dialog` (`rounded-3xl`, max-width 720 px, body in `ScrollArea`, title = spec title, close on Esc, focus trapped and restored) that fetches FR-011 on open and renders the Markdown with `react-markdown` + `remark-gfm` without `rehype-raw` (F18-D3); links open in a new tab with `rel="noopener noreferrer"`; images are not rendered (component override returns the alt text); a Download button is in the footer. | must | PRD-061, NFR-006 | AC-021, AC-022 |
| FR-015 | The list shall refresh when a SPEC run finishes (the requester's `useRealtimeRun.onComplete`, and for everyone when `AiStatus` transitions `running(kind SPEC) → idle`) and when the tab is activated; stale-while-revalidate with a 30 s window. | should | UX | AC-023 |
| FR-016 | The client shall call `POST /api/ai/spec` from the Specs tab only; the prompt box in the AI Architect tab never triggers spec generation. | must | scope | AC-019 |
| FR-017 | Deleting a project (F03) shall cascade `ProjectSpec` rows and best-effort delete blobs under `specs/{projectId}/` (`list({ prefix })` then `del`), logging failures — F03's `deleteProjectCore` / `lib/projects/externals.ts` is extended, not duplicated. | must | domain-model.md invariant 7 | AC-024 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-001 | Four endpoints, each with `requireProjectRole`; spec lookups are always `{ id, projectId }`; task re-verifies the `TaskRun`. |
| NFR-002 | Zod on the route body, task payload, writer input, writer output (length/shape), list query (none), route params (cuid format). |
| NFR-003 | Spec list load ≤ 500 ms p95 (single indexed query); preview fetch ≤ 2 s for a 512 KB spec (measured in L3). |
| NFR-004 | Caps: 300 nodes / 600 edges input; 512 KB output; 50 specs listed. |
| NFR-006 | Dialog focus trap/restore; list rows are buttons with labels; download links have `aria-label="Download <title>"`. |
| NFR-008 | Blob access only in the task (Trigger env) and route handlers (OIDC on Vercel); no `blobPath`/URL in responses. |
| NFR-009 | Task and routes log `runId`/`requestId`, `projectId`, `userId`, `specId`. |

## UX and interaction behaviour

| State | Specs tab | Generate button |
|---|---|---|
| Viewer | list + preview + download; no generate controls | hidden |
| Editor, idle, no specs | empty state "No specs yet — generate one from the current diagram." | enabled |
| Editor, run active (any kind) | list; strip (F16) shows status | disabled (spinner if SPEC) |
| Editor, empty canvas | list | enabled; run fails fast with the "nothing to describe" message |
| Route error | local system bubble in the AI Architect tab **and** an inline alert in the Specs tab | enabled |
| Preview open | dialog with rendered Markdown; loading skeleton ≤ 2 s; error alert with retry on failure | — |

Copy: button "Generate spec"; checkbox "Include recent chat"; row actions "Preview", "Download"; failure copy per reason: `EMPTY_GRAPH` → "the diagram is empty"; `GRAPH_TOO_LARGE` → "the diagram is too large (max 300 nodes)"; `INVALID_SPEC` → "the AI returned an unusable document"; `WRITER_ERROR` → "the AI provider did not respond"; `STORE_ERROR` → "the spec could not be saved".
Keyboard: list rows focusable; Enter opens preview; Dialog Esc closes; Tab order Generate → checkbox → rows → actions.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Concurrent spec runs (two editors click within 1 s) | Second gets 409 (F18-D2); race fallback via `concurrencyKey` + task verification (F17 EC-002) | AC-003 |
| EC-002 | Spec run while a design run is active | 409 `CONFLICT` with message "A run is already in progress" | AC-003 |
| EC-003 | `put` succeeded, row insert fails (DB outage) | `del` attempted; error log with `blobPath`; `STORE_ERROR` reported; no row | AC-012 |
| EC-004 | `put` fails with "already exists" (pathname collision — cuid reuse is practically impossible) | `STORE_ERROR`; logged; no row | AC-011 |
| EC-005 | Huge graph (> 300 nodes) | `GRAPH_TOO_LARGE` before calling the writer; no provider cost | AC-006 |
| EC-006 | Writer returns Markdown with raw HTML, `<script>`, `javascript:` links, images | Stored as-is (it is the user's file); preview renders HTML as text, drops unsafe URLs, images as alt text | AC-022 |
| EC-007 | Writer returns 600 KB | `INVALID_SPEC` after the retry; nothing stored | AC-009 |
| EC-008 | Blob missing for an existing row (manual deletion) | Preview/download 404 with a logged `{ specId, blobPath }`; list still shows the row (manual cleanup) | AC-017 |
| EC-009 | `specId` of another project | 404 (lookup includes `projectId`) | AC-016 |
| EC-010 | Requester removed between trigger and run | `UNAUTHORIZED_RUN`; nothing stored | AC-005 |
| EC-011 | Chat transport missing (`chat` key absent) | `chat` omitted; spec generated without it | AC-007 |
| EC-012 | Blob quota exceeded (Hobby 2k advanced ops) | `put` rejects → `STORE_ERROR`; F15 cost table flags quota | AC-011 |
| EC-013 | Preview opened for a spec whose fetch exceeds 10 s | Loading state → error alert with "Retry"; dialog remains open | AC-021 |
