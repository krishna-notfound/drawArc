# F17 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | The repo shall contain a Trigger.dev 4.7.x setup: `trigger.config.ts` (`dirs: ['./trigger']`, `maxDuration: 300`, `syncVercelEnvVars()` build extension, default `retry.maxAttempts: 1`), a `/trigger` directory, `TRIGGER_SECRET_KEY` validated in `lib/env.ts` (server-only), and npm scripts `dev:trigger` (`trigger.dev dev`) documented alongside `npm run dev`. | must | PRD-051 | AC-001 |
| FR-002 | `POST /api/ai/design` shall: `requireUser` → parse body `{ projectId: cuid, prompt: 1..2000 chars }` with Zod (400 on failure) → `requireProjectRole(projectId, 'editor')` (403 for viewer, 403 for non-member — identical body, no existence leak) → rate limit (≤ 10 `TaskRun` rows per `requestedById` in the last 60 min, any kind; 429 `RATE_LIMITED`) → active-run check (any `TaskRun` for the project with status `QUEUED`/`RUNNING` created < 10 min ago; 409 `CONFLICT`) → create `TaskRun { kind: 'DESIGN', status: 'QUEUED', requestedById, projectId }` → `tasks.trigger('design-agent', payload, { idempotencyKey: taskRun.id, concurrencyKey: projectId })` → update `runId` → return 201 `{ runId, publicToken }`. | must | PRD-051, PRD-055, NFR-001 | AC-002, AC-003, AC-004, AC-005, AC-006 |
| FR-003 | `publicToken` shall be created with `auth.createPublicToken({ scopes: { read: { runs: [runId] } }, expirationTime: '1h' })`; it grants read access to that run only. | must | PRD-051 | AC-007 |
| FR-004 | `POST /api/ai/design/token` shall accept `{ runId }`, require a user, load the `TaskRun` by `runId`, and return 200 `{ publicToken }` only when `taskRun.requestedById === user.id`; otherwise 404 `NOT_FOUND` (same body for missing and not-owned). It is kind-agnostic (F18 reuses it). | must | PRD-051 | AC-008 |
| FR-005 | The Prisma schema shall gain `TaskRun` per domain-model.md with `runId String? @unique` (F17-D3), enums `TaskRunKind { DESIGN SPEC }` and `TaskRunStatus { QUEUED RUNNING SUCCEEDED FAILED CANCELED }`, indexes `(projectId, status)`, `(requestedById, createdAt)`, cascade on project delete; delivered as a migration that requires **separate authorization**. | must | domain-model.md | AC-009 |
| FR-006 | On trigger failure after the row insert, the handler shall mark the row `FAILED`, log with `requestId`/`projectId`/`userId`, and return 502 `UPSTREAM`. | must | EC-001 | AC-010 |
| FR-007 | `trigger/design-agent.ts` shall be a `schemaTask` (`id: 'design-agent'`, payload `{ taskRunId: cuid, projectId: cuid, requestedById: cuid, prompt }`, `retry: { maxAttempts: 1 }`, `concurrency: { perKey: 1 }`, `maxDuration: 300`) that first loads the `TaskRun` by `taskRunId` and aborts (status `FAILED`, reason `UNAUTHORIZED_RUN`) unless the row exists, `kind === 'DESIGN'`, `projectId` matches, and `getProjectRole(requester, projectId)` is still `owner` or `editor`. | must | NFR-001, security-model.md | AC-011, AC-012 |
| FR-008 | After verification the task shall set `TaskRun.status = RUNNING`, write `AiStatus { state: 'running', kind: 'DESIGN', text: 'Starting…' }` and `metadata.set('progress', { step: 'start', percentage: 5 })`, then call `createVersionHistorySnapshot(projectId)` before any room mutation. | must | PRD-054 | AC-013 |
| FR-009 | The task shall call `setPresence(projectId, { userId: 'ai', userInfo: AI_PARTICIPANT.info, data: { thinking: true, cursor }, ttl: 60 })` before planning and refresh it every 30 s until completion; at completion or failure it shall set `{ thinking: false, cursor: null }` with `ttl: 2` so the participant disappears within 2 s. | must | PRD-052 | AC-014 |
| FR-010 | The task shall read the current graph server-side through `readFlow(projectId): Promise<CanvasDocument>` (a read-only `mutateFlow` callback returning `flow.toJSON()` normalised by `lib/canvas/serialize.ts`; fallback `getStorageDocument`), never from client-supplied nodes/edges. | must | NFR-001 | AC-015 |
| FR-011 | The task shall call `planDesign(input)` where `input = { prompt, graph, chat (last 20 messages, optional), constraints }` and receive a `DesignPlan` parsed by `DesignPlanSchema`; on a Zod or semantic validation failure it shall retry `planDesign` once with `validationErrors` appended to the input; a second failure fails the run with reason `INVALID_PLAN`. | must | PRD-053, NFR-002 | AC-016, AC-017 |
| FR-012 | Semantic validation (`validatePlan`) shall reject: shapes ∉ `NODE_SHAPES`; colours ∉ `NODE_COLOR_IDS`; labels empty or > 60 chars; > 60 `addNode` or > 120 `addEdge` operations; edges whose endpoints are neither existing ids nor refs defined earlier in the plan; self-edges; duplicate `(source, target, handles)`; handles ∉ `top/right/bottom/left`; any `updateNode`/`updateNodeData`/`removeNode`/`updateEdge`/`removeEdge` targeting a pre-existing id (F17-D1); resulting totals > 2,000 nodes / 4,000 edges. | must | PRD-053 | AC-017 |
| FR-013 | `layoutPlan(graph, plan)` shall assign a position, width and height to every new node deterministically (rules in 02-design.md) so that no node's padded bounding box (24 px padding) intersects any other node's, existing or new; if a free cell cannot be found within 50 shifts the run fails with reason `LAYOUT_FAILED` and nothing is applied. | must | PRD-053 | AC-018, AC-019 |
| FR-014 | The task shall apply the positioned plan in **one** `mutateFlow({ client, roomId: projectId, storageKey: 'flow' }, flow => …)` callback containing no `await`; operations are applied in plan order; at apply time an `addEdge` whose existing-node endpoint no longer exists is skipped and counted; node ids are `${shape}_${ulid}`, edge ids `e_${ulid}`, node `type: 'canvasNode'`, edge `type: 'canvasEdge'`, `data` exactly `CanvasNodeData` / `CanvasEdgeData`. | must | PRD-052, PRD-053, F17-D2 | AC-020, AC-021 |
| FR-015 | During the run the task shall write status text at each step (`Starting…`, `Reading the diagram…`, `Planning…`, `Placing N nodes…`, `Done`) via `setAiStatus` and `metadata.set('progress', …)`; on success it shall append an assistant chat message with the plan `summary` and counts ("Added 6 nodes and 7 edges."), set `AiStatus` idle, and set `TaskRun.status = SUCCEEDED`. | must | PRD-050, PRD-052 | AC-022 |
| FR-016 | On any failure (verification, planner error/timeout, invalid plan, layout, Liveblocks error) the task's `onFailure` hook shall: append a system chat message "drawArc AI could not complete this request: <reason>.", set `AiStatus` idle, clear presence, set `TaskRun.status = FAILED`, and log `{ runId, projectId, userId, reason }` at error level. Nothing is applied to the room when the failure happens before the apply pass. | must | PRD-053, NFR-009 | AC-023, AC-024 |
| FR-017 | The client Send action (F16 `ChatComposer`) shall, for editors/owners: append the user chat message, call `POST /api/ai/design`, store `{ runId, publicToken }` in component state, and subscribe with `useRealtimeRun(runId, { accessToken: publicToken })`; while `run.status` is not final the input is disabled and the strip shows `run.metadata.progress.text` (falling back to `AiStatus.text`); on `onComplete` the state resets. A 4xx/5xx from the route shows a system chat message locally (not appended to the room) with the error message. | must | PRD-051 | AC-025, AC-026 |
| FR-018 | Agent writes shall never enter any user's undo stack: after a run, a user's Ctrl+Z reverts only that user's own last change. | must | PRD-052, D-013 | AC-027 |
| FR-019 | The five canonical prompts shall exist as fixtures (`tests/fixtures/ai/prompts.json`) with one `FakePlanner` plan each (`tests/fixtures/ai/plans/<n>.json`) that passes validation and layout; the success metric procedure uses them. | must | project-overview.md metric | AC-028 |
| FR-020 | `lib/env.ts` shall validate `AI_PROVIDER` (`'fake' | <provider id chosen at Gate 6>`, default `fake` outside production) and declare the provider key (server-only, name fixed at SDK selection) as **optional** — it is set only in the Trigger.dev environment, never in the Next.js env; `createPlanner` shall fail fast with a message naming the key when `AI_PROVIDER` is live and the key is absent. `AI_PROVIDER=fake` is the default in test and CI so no test needs a live provider. | must | NFR-008 | AC-029 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-001 | Route: `requireProjectRole(projectId, 'editor')`; task: re-verifies by `TaskRun` ownership and role at run time; token route: `requestedById` check. `projectId` from the body is only an argument to `requireProjectRole`. |
| NFR-002 | Zod at: route body, task payload (`schemaTask`), planner output (`DesignPlanSchema`), apply input (`CanvasNodeDataSchema` per node), status/chat writes (F16 schemas). |
| NFR-003 | Agent writes propagate like any Storage write (< 1 s remote render, measured in TC-030). |
| NFR-004 | Plan caps (60 nodes / 120 edges per run) and total caps (2,000 / 4,000) keep the room under the snapshot limit. |
| NFR-008 | `TRIGGER_SECRET_KEY`, `LIVEBLOCKS_SECRET_KEY`, provider key are server/Trigger-only; the client receives only the run-scoped public token (1 h). F15 bundle scan covers the new keys. |
| NFR-009 | Every log line in the route and task carries `requestId` (route) or `runId` (task), `projectId`, `userId`. |

## UX and interaction behaviour

| Phase | Requester sees | Other members see | Input |
|---|---|---|---|
| Send | own user bubble; strip "Starting…" (from `useRealtimeRun` metadata, or `AiStatus` until the first metadata arrives) | user bubble; strip "Starting…" via `AiStatus` | disabled for everyone (`AiStatus.running` or local run state) |
| Planning | strip "Planning…"; AI avatar + thinking cursor near the layout origin | same | disabled |
| Apply | nodes/edges appear in one batch; strip "Placing 6 nodes…" | same | disabled |
| Done | assistant bubble with summary; strip hidden | same | enabled |
| Failed | system bubble with reason; strip hidden | same | enabled |
| Route error (4xx/5xx) | local system bubble ("Too many requests — try again in N minutes", "A run is already in progress", "Viewers cannot start runs") | nothing | enabled |

Copy for reasons: `INVALID_PLAN` → "the AI produced an invalid plan"; `LAYOUT_FAILED` → "the diagram could not be laid out without overlaps"; `PLANNER_ERROR` → "the AI provider did not respond"; `UNAUTHORIZED_RUN` → "the request is no longer authorized"; `ROOM_ERROR` → "the room could not be updated".

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | `tasks.trigger` throws after the `TaskRun` insert | Row `FAILED`; 502 `UPSTREAM`; no `AiStatus` change | AC-010 |
| EC-002 | Same request retried by the client (double click within the handler's window) | Second call hits the active-run check → 409; if both pass simultaneously, Trigger.dev `concurrencyKey` serialises the runs and the second run's verification finds another `RUNNING`/`SUCCEEDED` row for the same project created in the last 10 min → it aborts with `UNAUTHORIZED_RUN`, applies nothing, and marks its own row `FAILED` | AC-006 (route), AC-012 (task) |
| EC-003 | Requester downgraded to viewer or removed while the run is queued | Task verification fails → `FAILED`, chat message, no mutation | AC-012 |
| EC-004 | Planner returns malformed JSON / schema violation twice | `INVALID_PLAN`; nothing applied | AC-017 |
| EC-005 | Planner references a node id that a user deleted between read and apply | `addEdge` to it skipped at apply time; summary says "1 connection skipped (node no longer exists)" | AC-021 |
| EC-006 | A user adds a node where the layout placed a new node between read and apply | Overlap is possible (accepted, LWW-free since different keys); summary unchanged; R-13 recorded | — (documented) |
| EC-007 | Planner timeout (> 90 s) | `PLANNER_ERROR`; `AbortSignal` passed to the provider | AC-023 |
| EC-008 | Liveblocks `mutateFlow` rejects (network/5xx) | `ROOM_ERROR`; version snapshot already exists for manual restore; status failed | AC-023 |
| EC-009 | Task crashes without running `onFailure` (OOM/kill) | F16 stale guard frees the input after 10 min; `TaskRun` stays `RUNNING` — F15 log inspection; a reconciliation script is a future task | AC-024 (hook path) + F16/AC-017 |
| EC-010 | Empty canvas vs non-empty canvas | Layout origin (0,0) when empty; right of the existing bbox when non-empty | AC-018 |
| EC-011 | Prompt asks to modify existing nodes ("rename the API gateway") | Validator rejects mutating ops on pre-existing ids → `INVALID_PLAN`; the system message adds "In this version the AI can only add to the diagram." | AC-017 |
| EC-012 | Public token expired (> 1 h) while the sidebar is open | `useRealtimeRun` errors → client calls `POST /api/ai/design/token` once to re-issue; on 404 it falls back to `AiStatus` only | AC-026 |
| EC-013 | Huge prompt (2,000 chars) or chat context with long messages | Input to the planner is truncated: prompt ≤ 2,000, chat ≤ 20 messages × 500 chars | AC-016 |
| EC-014 | `TRIGGER_SECRET_KEY` missing in the Vercel env | `lib/env.ts` fails at boot in server context; route returns 500 before any DB write (covered by F00 env test) | — (F00) |
