# F17 — Design

## Architecture and components

```
ChatComposer (F16) ──POST /api/ai/design──► route.ts ──Prisma TaskRun──► Neon
       │                                        │ tasks.trigger(idempotencyKey = taskRun.id)
       │ useRealtimeRun(runId, publicToken)      ▼
       ◄──────── Trigger.dev Realtime ──── trigger/design-agent.ts
                                                │ verify TaskRun → role
                                                │ createVersionHistorySnapshot · setPresence('ai')
                                                │ readFlow → planDesign (LLM, outside Liveblocks)
                                                │ validatePlan → layoutPlan → mutateFlow (sync)
                                                │ setAiStatus / appendChatMessage (F16 lib/chat/server.ts)
                                                ▼
                                        Liveblocks room (projectId) ──► all clients (origin: remote)
```

Files created / modified (dependency direction `app → components → lib → SDKs`; `trigger → lib/types`):

| Path | Responsibility |
|---|---|
| `trigger.config.ts` | `defineConfig({ project: '<proj ref>', dirs: ['./trigger'], maxDuration: 300, retries: { enabledInDev: false, default: { maxAttempts: 1 } }, build: { extensions: [syncVercelEnvVars()] } })` |
| `trigger/design-agent.ts` | the `schemaTask`; orchestration only, no business logic inline |
| `lib/ai/schemas.ts` | `DesignPlanSchema`, `DesignOperationSchema`, `PlannerInputSchema`, `PositionedPlanSchema`, `RunFailureReason` |
| `lib/ai/planner.ts` | `interface Planner { planDesign(input, opts: { signal }): Promise<unknown> }`, `createPlanner(env)` factory (returns `FakePlanner` when `AI_PROVIDER='fake'`) |
| `lib/ai/fake-planner.ts` | fixture-backed planner: picks `tests/fixtures/ai/plans/<n>.json` by prompt hash; `FAIL:` prefixed prompts return invalid plans for tests |
| `lib/ai/providers/<sdk>.ts` | added at Gate 6 after SDK selection; the only file that imports an LLM SDK |
| `lib/ai/validate.ts` | `validatePlan(graph, plan) → { ok: true, resolved } \| { ok: false, errors[] }` (ref → id resolution, F17-D1 rules) |
| `lib/ai/layout.ts` | `layoutPlan(graph, resolved) → PositionedPlan` (pure, deterministic) |
| `lib/ai/apply.ts` | `applyPlan(flow: MutableFlow, positioned) → ApplyReport` (synchronous; no I/O) |
| `lib/ai/rate-limit.ts` | `assertAiRunAllowed(userId, projectId)` — DB counts (10/h/user; 1 active/project) |
| `lib/liveblocks-flow.ts` (F13, extended) | F13 created it with `seedRoomIfEmpty`/`readFlowCounts` (D-034); F17 adds `readFlow(roomId)`, `aiPresence(roomId, state)`, `snapshot(roomId)` wrappers over `@liveblocks/react-flow/node` and `@liveblocks/node` |
| `lib/trigger.ts` | `createRunToken(runId)`; `TaskRunRepo` (create/markRunning/markSucceeded/markFailed) |
| `app/api/ai/design/route.ts`, `app/api/ai/design/token/route.ts` | handlers |
| `prisma/schema.prisma` + `prisma/migrations/<ts>_task_run/` | `TaskRun` (separate authorization) |
| `hooks/useDesignRun.ts` | client: start run, token, `useRealtimeRun`, re-issue on expiry |
| `components/ai/ChatComposer.tsx` (F16, modified) | Send → `useDesignRun.start(prompt)` |
| `types/liveblocks.config.ts` (F05/F16, modified) | `AI_PARTICIPANT = { id: 'ai', info: { name: 'drawArc AI', avatar: null, color: userColor('ai') } }` — colour comes from F05's `userColor` / `USER_COLORS` (hash of the id), so no new colour value is introduced |
| `lib/canvas/ids.ts` (F07), `lib/canvas/connections.ts` (F09), `DEFAULT_SIZES` (F06) | reused, not modified: `newNodeId(shape)`, `newEdgeId()`, `buildEdge(connection, id)`, default sizes per shape |
| `tests/fixtures/ai/prompts.json`, `tests/fixtures/ai/plans/1..5.json`, `tests/fixtures/ai/invalid/*.json` | fixtures |

Server vs client: the route and the task are the only writers of `TaskRun`; the task is the only writer of the room on behalf of the AI; the client never computes positions or touches nodes — it only observes.

## Domain model and TypeScript contracts

```ts
// lib/ai/schemas.ts
import { NODE_SHAPES, NODE_COLOR_IDS } from '@/types/canvas';
const Ref = z.string().regex(/^r[0-9]{1,3}$/);                 // planner-local handle for new items: r1, r2 …
const NodeId = z.string().regex(/^(rectangle|diamond|circle|pill|cylinder|hexagon)_[0-9A-HJKMNP-TV-Z]{26}$/);
const EdgeId = z.string().regex(/^e_[0-9A-HJKMNP-TV-Z]{26}$/);
const Handle = z.enum(['top', 'right', 'bottom', 'left']);
const Target = z.union([Ref, NodeId]);                          // existing id or ref

export const DesignOperationSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('addNode'), ref: Ref, shape: z.enum(NODE_SHAPES), color: z.enum(NODE_COLOR_IDS),
             label: z.string().min(1).max(60), group: z.string().max(30).optional() }),   // group = layout hint only
  z.object({ op: z.literal('updateNode'), target: Target, width: z.number().int().min(48).max(800).optional(),
             height: z.number().int().min(32).max(800).optional() }),                     // position is never LLM-chosen
  z.object({ op: z.literal('updateNodeData'), target: Target, label: z.string().min(1).max(60).optional(),
             color: z.enum(NODE_COLOR_IDS).optional(), shape: z.enum(NODE_SHAPES).optional() }),
  z.object({ op: z.literal('removeNode'), target: Target }),
  z.object({ op: z.literal('addEdge'), ref: Ref, source: Target, target: Target,
             sourceHandle: Handle.optional(), targetHandle: Handle.optional(), label: z.string().max(40).optional() }),
  z.object({ op: z.literal('updateEdge'), target: z.union([Ref, EdgeId]), label: z.string().max(40).optional(),
             sourceHandle: Handle.optional(), targetHandle: Handle.optional() }),
  z.object({ op: z.literal('removeEdge'), target: z.union([Ref, EdgeId]) }),
]);
export const DesignPlanSchema = z.object({
  summary: z.string().min(1).max(300),
  operations: z.array(DesignOperationSchema).min(1).max(200),
});
export type DesignPlan = z.infer<typeof DesignPlanSchema>;

export const PlannerInputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  graph: CanvasDocumentSchema,                                  // current room content (F06)
  chat: z.array(ChatMessageSchema).max(20).optional(),          // F16; content truncated to 500 chars each
  constraints: z.object({ shapes: z.array(z.string()), colors: z.array(z.string()), maxNewNodes: z.literal(60),
                          maxNewEdges: z.literal(120), existingNodeIds: z.array(NodeId), additiveOnly: z.literal(true) }),
  validationErrors: z.array(z.string()).max(20).optional(),     // set on the single retry
});
export type PlannerInput = z.infer<typeof PlannerInputSchema>;

export type RunFailureReason = 'UNAUTHORIZED_RUN' | 'INVALID_PLAN' | 'LAYOUT_FAILED' | 'PLANNER_ERROR' | 'ROOM_ERROR';
```

Tool surface ↔ `MutableFlow` (1:1; `layout` is ours):

| Plan op | `MutableFlow` call in `applyPlan` |
|---|---|
| `addNode` | `flow.addNode({ id: newNodeId(shape), type: 'canvasNode', position, width, height, data: { label, shape, color } })` (id helper from F07 `lib/canvas/ids.ts`) |
| `updateNode` | `flow.updateNode(id, { width, height })` |
| `updateNodeData` | `flow.updateNodeData(id, { label?, color?, shape? })` |
| `removeNode` | `flow.removeNode(id)` (edges to it are removed by the package's `onDelete` semantics — re-verify in T-004 spike; else remove edges explicitly first) |
| `addEdge` | `flow.addEdge(buildEdge({ source, target, sourceHandle, targetHandle }, newEdgeId()))` with `data.label` set when present — `buildEdge` from F09 `lib/canvas/connections.ts` so agent edges are byte-identical in shape to user-drawn ones (`type: 'canvasEdge'`, markers per F09) |
| `updateEdge` | `flow.updateEdge(id, { sourceHandle?, targetHandle? })` + `flow.updateEdgeData(id, { label })` when label present |
| `removeEdge` | `flow.removeEdge(id)` |
| `layout` (step) | `layoutPlan` computes `position/width/height` for every `addNode` before apply; not an LLM op |

Planner contract:

```ts
// lib/ai/planner.ts
export interface Planner { planDesign(input: PlannerInput, opts: { signal: AbortSignal; runId: string }): Promise<unknown>; }
// The task parses the result with DesignPlanSchema; providers return raw JSON objects, never pre-validated types.
export function createPlanner(env: Env): Planner;   // 'fake' → FakePlanner; else provider module chosen at Gate 6
```

Layout rules (PROPOSED, `lib/ai/layout.ts`):
1. Default sizes per shape from F06's `DEFAULT_SIZES` (ui-context.md values: rectangle 180×80, pill 180×64, circle 96×96, diamond 140×140, cylinder 140×110, hexagon 160×110); `updateNode` width/height overrides apply before placement.
2. Build a DAG over new nodes from new edges (ignore edges to existing nodes for layering, ignore cycles by DFS back-edge removal). Column = longest-path layer from sources; rows = order of first appearance within a layer; nodes with the same `group` hint are kept adjacent within their layer.
3. Column pitch 260 px, row pitch 170 px, measured from the origin. Origin = `(0, 0)` when the graph is empty; otherwise `(existingBBox.maxX + 120, existingBBox.minY)`.
4. Position = `(origin.x + col * 260 + (260 − w)/2, origin.y + row * 170 + (170 − h)/2)` (cell-centred, integer-rounded).
5. Overlap check: AABB of every placed node padded by 24 px must not intersect any existing or already-placed node; on conflict shift the node right by 260 px, up to 50 times; still conflicting → `LAYOUT_FAILED`.
6. Handles for new edges when the planner omitted them: `right → left` when the target column is greater, `bottom → top` when equal column and greater row, else `left → right`.
7. Pure, deterministic: same `(graph, plan)` → same output (snapshot-tested).

Positioned plan: `PositionedPlan = { summary, nodes: PersistedNode[], edges: PersistedEdge[], updates: {...}[], removals: {...}[] }` where every node/edge has final ids and the whole thing validates against `CanvasDocumentSchema` when merged with the current graph (`mergeForValidation`) — the same schema templates (F14) use.

Apply-time drift rules (F17-D2): for each `addEdge` whose endpoint is an existing id, `flow.getEdge/getNode` is checked inside the callback; missing → skipped and counted in `ApplyReport.skippedEdges`. New-node ops always apply. The callback contains no `await`.

Prisma (migration requires separate authorization):

```prisma
enum TaskRunKind { DESIGN SPEC }
enum TaskRunStatus { QUEUED RUNNING SUCCEEDED FAILED CANCELED }
model TaskRun {
  id            String        @id @default(cuid())
  runId         String?       @unique                 // F17-D3: null until Trigger.dev acknowledges
  kind          TaskRunKind
  projectId     String
  project       Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  requestedById String
  requestedBy   User          @relation(fields: [requestedById], references: [id])
  status        TaskRunStatus @default(QUEUED)
  failureReason String?                                // RunFailureReason
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  @@index([projectId, status])
  @@index([requestedById, createdAt])
}
```
`runId` nullable and `failureReason` are now part of `context/domain-model.md`'s `TaskRun` (Gate 4); the Prisma model above matches it field for field.

## Data and state ownership

| State | Owner | Notes |
|---|---|---|
| Run status/attempts/metadata | Trigger.dev | `TaskRun.status` mirrors via task hooks; Trigger.dev wins on disagreement |
| Run ownership (who may get a token) | Postgres `TaskRun.requestedById` | audit trail |
| Agent output | Liveblocks Storage `flow` (via `mutateFlow`) | same owner as user edits; Blob snapshot follows via the editors' autosave (F13) — the task never writes Blob |
| Version snapshot before the run | Liveblocks version history | 24 h Free / 30 d Pro retention (D-022) |
| AI presence | Liveblocks Presence (`setPresence`, TTL) | ephemeral |
| Status/chat | F16 transport | |
| `runId`/`publicToken` in the sidebar | client memory | lost on reload; the strip then follows `AiStatus` only (acceptable) |

## API and integration contracts

| Endpoint | Auth / min role | Request (Zod) | Response | Errors |
|---|---|---|---|---|
| `POST /api/ai/design` | `requireUser`; `requireProjectRole(projectId, 'editor')` | `{ projectId: cuid, prompt: string(1..2000) }` | 201 `{ runId: string, publicToken: string }` | 400 `VALIDATION`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 409 `CONFLICT` (active run), 429 `RATE_LIMITED` (`retryAfterSeconds`), 502 `UPSTREAM` |
| `POST /api/ai/design/token` | `requireUser`; `TaskRun.requestedById === user.id` | `{ runId: string(1..64) }` | 200 `{ publicToken }` | 400, 401, 404 `NOT_FOUND` (missing or not owned) |

Trigger.dev task `design-agent`: payload `{ taskRunId, projectId, requestedById, prompt }`; trigger options `{ idempotencyKey: taskRunId, idempotencyKeyTTL: '1h', concurrencyKey: projectId }`; task options `{ retry: { maxAttempts: 1 }, concurrency: { perKey: 1 }, maxDuration: 300 }`; hooks `onFailure` (FR-016), `onSuccess` (mark `SUCCEEDED`). Metadata: `progress: { step: 'start'|'read'|'plan'|'layout'|'apply'|'done', percentage: number, text: string }`. Output `{ added: { nodes, edges }, skippedEdges, summary }`.

Liveblocks: `createVersionHistorySnapshot(projectId)`; `setPresence(projectId, { userId: 'ai', userInfo, data: { thinking, cursor }, ttl })`; `mutateFlow({ client, roomId: projectId, storageKey: 'flow' }, cb)`; `lib/chat/server.ts` for status and chat.

## Security and validation

- Trust: the browser supplies only `prompt` and `projectId`; both are validated and `projectId` is authorized. The task trusts its payload only after re-loading the `TaskRun` and re-computing the role (a removed member's queued run aborts). The LLM output is untrusted: Zod shape → semantic validation → layout → `CanvasDocumentSchema` on the merged result.
- Secrets: `TRIGGER_SECRET_KEY` (Next.js server, to trigger and mint tokens), `LIVEBLOCKS_SECRET_KEY` + `DATABASE_URL` + provider key (Trigger.dev env via `syncVercelEnvVars`). Nothing AI-related is `NEXT_PUBLIC_*`. The public token is run-scoped and read-only, 1 h.
- Prompt injection: the planner prompt states that the graph/chat are data; even if ignored, the only effect an injected instruction can have is a different plan, which still passes the same validator — there is no tool that reaches outside the room.
- Rate limits: 10 runs/user/hour (DB count on `TaskRun`), 1 active run/project (DB check + `concurrencyKey`). No Redis.
- Logging: route logs `{ requestId, userId, projectId, taskRunId, runId }`; task logs `{ runId, projectId, userId, step }`; never the prompt at info level (log a 64-char prefix at debug only).
- Do not add `export const dynamic = 'force-dynamic'` to the routes (code-standards.md rule 2) despite Trigger.dev's Next guide; the handlers read `request` and are dynamic by construction.

## SDK selection (Gate-6 decision, OPEN)

| | Anthropic SDK direct (`@anthropic-ai/sdk`) with Claude | Vercel AI SDK `generateObject` (`ai` + a provider package) |
|---|---|---|
| Provider file | `lib/ai/providers/anthropic.ts` using tool-use with one tool `submit_plan` whose input schema is `DesignPlanSchema` converted to JSON Schema (`zod-to-json-schema`), `max_tokens` ≈ 4,000, `temperature` 0.2 | `lib/ai/providers/ai-sdk.ts` using `generateObject({ model, schema: DesignPlanSchema, prompt })` |
| Env | `ANTHROPIC_API_KEY`, `AI_MODEL` | provider key + `AI_MODEL`; provider swap is one import |
| What changes elsewhere | nothing — contract returns raw JSON | nothing — same |
| Trade-offs | one dependency, direct control of tool-use and caching; model-specific | provider-agnostic; extra abstraction; `generateObject` schema support varies by provider (UNVERIFIED for the chosen one) |
| Versions | UNVERIFIED (not researched); verify at Gate 6 | UNVERIFIED; verify at Gate 6 |

Either way the fake planner is the default in tests; the live-provider manual check (05-test-plan.md) is the only place a real key is used.

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| `schemaTask` validates payload with Zod at the worker; `tasks.trigger<typeof t>()` does not parse at trigger time | https://trigger.dev/docs/tasks/schemaTask | 2026-10-22 |
| `idempotencyKey` + `idempotencyKeyTTL` on `trigger`; failed runs clear their key | https://trigger.dev/docs/idempotency | 2026-10-22 |
| `concurrency: { perKey: 1 }` with `concurrencyKey` at trigger time | https://trigger.dev/docs/queue-concurrency | 2026-10-22 |
| `metadata.set` (256 KB cap); progress pattern; `metadata.stream` deprecated | https://trigger.dev/docs/runs/metadata | 2026-10-22 |
| `auth.createPublicToken({ scopes: { read: { runs: [...] } }, expirationTime: '1hr' })` (default 15 min) | https://trigger.dev/docs/realtime/auth | 2026-10-22 |
| `useRealtimeRun(runId, { accessToken, onComplete })` in a `'use client'` file | https://trigger.dev/docs/realtime/react-hooks/subscribe | 2026-10-22 |
| Lifecycle hooks `onSuccess`/`onFailure` take one object; `retry.maxAttempts`; `maxDuration` | https://trigger.dev/docs/tasks/overview | 2026-10-22 |
| Env vars via dashboard or `syncVercelEnvVars()` build extension (deploy only; dev loads `.env.local`) | https://trigger.dev/docs/deploy-environment-variables | 2026-10-22 |
| Free plan: 10 concurrent Realtime connections, 20 concurrent runs; payload 3 MB | https://trigger.dev/pricing , https://trigger.dev/docs/limits | 2026-10-22 |
| `mutateFlow({ client, roomId, storageKey }, cb)` exposes `addNode/updateNode/updateNodeData/removeNode/addEdge/updateEdge/updateEdgeData/removeEdge/toJSON`; changes flush periodically and at the end | https://liveblocks.io/docs/api-reference/liveblocks-react-flow | 2026-10-22 |
| `mutateStorage` is not a transaction across `await`; "no presence will be shown" → pair with `setPresence` | https://liveblocks.io/docs/products/sync/server-side-editing | 2026-10-22 |
| `setPresence(roomId, { userId, userInfo, data, ttl })`, TTL 2–3599 s; agentic pattern snapshot → presence → mutate | https://liveblocks.io/docs/products/sync/agentic-editing | 2026-10-22 |
| Version history snapshots Storage; "snapshot before AI" | https://liveblocks.io/docs/products/sync/version-history | 2026-10-22 |
| Undo affects only the current client's operations (per-client history) | https://liveblocks.io/docs/api-reference/liveblocks-react | 2026-10-22 |
| **UNVERIFIED (inferred)** — server writes arrive as `origin: 'remote'` and are not recorded in client history; research §6 says "inferred" — proven by AC-027 (E2E) rather than assumed | https://liveblocks.io/docs/products/sync/server-side-editing | — |
| **UNVERIFIED** — a read-only `mutateFlow` callback (no changes) produces no storage update / version noise; `getStorageDocument` shape of the `flow` key — T-004 spike decides `readFlow` implementation | — | — |
| **UNVERIFIED** — `removeNode` in `MutableFlow` removes incident edges | — | — |
| **UNVERIFIED** — Trigger.dev explicit Next.js 16 support (SDK has no Next peer dep; usage is plain fetch) | research/services.md §C1 | — |
