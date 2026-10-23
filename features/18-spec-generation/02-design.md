# F18 — Design

## Architecture and components

```
SpecsPanel ──POST /api/ai/spec──► route.ts ──TaskRun(SPEC)──► Neon
    │                                  │ tasks.trigger('generate-spec', …, { idempotencyKey, concurrencyKey })
    │ useRealtimeRun(runId, token)      ▼
    ◄──── Trigger.dev Realtime ── trigger/generate-spec.ts
    │                                  │ verify → readFlow (F17) → chat (F16) → writeSpec (LLM)
    │                                  │ validate → put('specs/{p}/{s}.md') → ProjectSpec row → report
    │ GET …/specs, …/specs/[id], …/specs/[id]/download  (proxied private Blob reads)
    ▼
SpecPreviewDialog (react-markdown + remark-gfm)
```

Files created / modified:

| Path | Responsibility |
|---|---|
| `trigger/generate-spec.ts` | the `schemaTask`; orchestration only |
| `lib/ai/spec-writer.ts` | `interface SpecWriter { writeSpec(input, opts): Promise<unknown> }`, `createSpecWriter(env)` (fake vs provider) |
| `lib/ai/fake-spec-writer.ts` | deterministic Markdown from the graph (headings per node, table of edges); `FAIL:` project descriptions produce invalid output for tests |
| `lib/ai/providers/<sdk>-spec.ts` | added after the Gate-6 SDK decision (same SDK as F17) |
| `lib/ai/spec-schemas.ts` | `SpecWriterInputSchema`, `validateSpecMarkdown(md) → { ok } \| { ok: false, error }`, `SPEC_LIMITS` |
| `lib/specs.ts` | `SpecRepo` (create/list/find `{ id, projectId }`), `specTitle(project, date)`, `specFilename(title)` |
| `lib/blob.ts` (F13, modified) | add `putSpec(path, md)`, `getSpec(path)`, `deleteSpecsForProject(projectId)` |
| `app/api/ai/spec/route.ts` | trigger route |
| `app/api/projects/[projectId]/specs/route.ts` | list |
| `app/api/projects/[projectId]/specs/[specId]/route.ts` | content JSON |
| `app/api/projects/[projectId]/specs/[specId]/download/route.ts` | attachment stream |
| `lib/projects/service.ts` + `lib/projects/externals.ts` (F03, modified) | `deleteProjectCore` also calls `deleteSpecsForProject` (best effort, logged) |
| `prisma/schema.prisma` + `prisma/migrations/<ts>_project_spec/` | `ProjectSpec` (separate authorization) |
| `hooks/useSpecRun.ts` | start spec run; reuses `useDesignRun` internals (`useRealtimeRun`, token re-issue) parameterised by endpoint |
| `hooks/useProjectSpecs.ts` | list fetch + refresh triggers (FR-015) |
| `components/ai/SpecsPanel.tsx` (F16, replaced) | tab content |
| `components/ai/SpecListItem.tsx`, `components/ai/SpecPreviewDialog.tsx`, `components/ai/SpecMarkdown.tsx` | list row; dialog; renderer wrapper with component overrides |

Server vs client: routes and the task own all Blob and Postgres access; the client receives JSON (`content` string) or an attachment stream, never a URL.

## Domain model and TypeScript contracts

```ts
// lib/ai/spec-schemas.ts
export const SPEC_LIMITS = { maxNodes: 300, maxEdges: 600, minChars: 200, maxBytes: 512 * 1024, maxChat: 50, maxChatChars: 500 } as const;

export const SpecWriterInputSchema = z.object({
  project: z.object({ name: z.string().min(1).max(100), description: z.string().max(500).nullable() }),
  graph: CanvasDocumentSchema,                                   // F06; node count ≤ 300 enforced before the call
  chat: z.array(ChatMessageSchema).max(SPEC_LIMITS.maxChat).optional(),
  generatedAt: z.string().datetime(),
  validationErrors: z.array(z.string()).max(5).optional(),       // set on the single retry
});
export type SpecWriterInput = z.infer<typeof SpecWriterInputSchema>;

export type SpecFailureReason = 'UNAUTHORIZED_RUN' | 'EMPTY_GRAPH' | 'GRAPH_TOO_LARGE' | 'INVALID_SPEC' | 'WRITER_ERROR' | 'STORE_ERROR';

export function validateSpecMarkdown(raw: unknown): { ok: true; markdown: string; sizeBytes: number } | { ok: false; error: string };
// rules: typeof string; trim; length ≥ 200 chars; Buffer.byteLength ≤ 524288; first non-blank line matches /^# \S/
```

```ts
// lib/ai/spec-writer.ts
export interface SpecWriter { writeSpec(input: SpecWriterInput, opts: { signal: AbortSignal; runId: string }): Promise<unknown>; }
export function createSpecWriter(env: Env): SpecWriter;   // 'fake' → FakeSpecWriter; else provider chosen at F17 Gate 6
```

The fake writer's output template (used in fixtures and tests): `# <project.name> — Technical Specification`, `## Overview` (node/edge counts), `## Components` (one `### <label>` per node with shape/colour), `## Connections` (GFM table source → target → label), `## Discussion` (only when `chat` present).

```ts
// API payloads
export const SpecRunRequestSchema = z.object({ projectId: z.string().cuid(), includeChat: z.boolean().default(true) });
export const SpecListItemSchema = z.object({ id: z.string().cuid(), title: z.string(), createdAt: z.string().datetime(),
  sizeBytes: z.number().int().nonnegative(), createdBy: z.object({ name: z.string().nullable() }) });
export const SpecContentSchema = SpecListItemSchema.pick({ id: true, title: true, createdAt: true }).extend({ content: z.string().max(524288) });
```

Prisma (migration requires separate authorization):

```prisma
model ProjectSpec {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  taskRunId   String?
  taskRun     TaskRun? @relation(fields: [taskRunId], references: [id], onDelete: SetNull)
  title       String
  blobPath    String   @unique                 // specs/{projectId}/{id}.md — never sent to clients
  sizeBytes   Int
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  @@index([projectId, createdAt])
}
```
`sizeBytes` is now part of `context/domain-model.md`'s `ProjectSpec` (Gate 4); the model above matches it field for field (shown in the list, used by F15 cost monitoring).

Task payload: `{ taskRunId: cuid, projectId: cuid, requestedById: cuid, includeChat: boolean }`. Output: `{ specId, title, sizeBytes }`. Metadata `progress: { step: 'start'|'read'|'write'|'save'|'done', percentage, text }`.

## Data and state ownership

| State | Owner | Notes |
|---|---|---|
| Spec content | Vercel Blob `specs/{projectId}/{specId}.md` (data-ownership.md) | immutable; `allowOverwrite: false`; deleted only with the project |
| Spec metadata | Postgres `ProjectSpec` | pointer + title + size; rebuilt manually if lost (row after blob) |
| Run state | Trigger.dev; mirrored in `TaskRun` (F17) | |
| Graph input | Liveblocks Storage via `readFlow` | the request never carries it (F18-D1) |
| Preview content in the dialog | client memory for the dialog's lifetime | not cached beyond 30 s SWR; never `localStorage` |
| List cache | client memory (SWR 30 s) | invalidated on run completion / tab activation |

Non-atomicity (Blob put → row): recorded in F17-style risk table below as R-15; mitigations FR-008.

## API and integration contracts

| Endpoint | Min role | Request | Response | Errors |
|---|---|---|---|---|
| `POST /api/ai/spec` | editor | `SpecRunRequestSchema` | 201 `{ runId, publicToken }` | 400 `VALIDATION`, 401, 403 `FORBIDDEN`, 409 `CONFLICT`, 429 `RATE_LIMITED`, 502 `UPSTREAM` |
| `POST /api/ai/design/token` (F17, reused) | run requester | `{ runId }` | 200 `{ publicToken }` | 401, 404 |
| `GET /api/projects/[projectId]/specs` | viewer | — (params: `projectId` cuid) | 200 `{ specs: SpecListItem[] }` | 400 (bad cuid), 401, 403 |
| `GET /api/projects/[projectId]/specs/[specId]` | viewer | — | 200 `SpecContent` | 400, 401, 403, 404 `NOT_FOUND` (wrong project, missing row, missing blob) |
| `GET /api/projects/[projectId]/specs/[specId]/download` | viewer | — | 200 stream, `text/markdown; charset=utf-8`, `Content-Disposition: attachment; filename="<slug>.md"; filename*=UTF-8''<encoded>` , `Cache-Control: private, no-store` | 400, 401, 403, 404 |

Non-member vs wrong-role: both 403 with identical body on all four routes (no existence leak; the workspace gate already denies the page). `requireProjectRole` reads `params` after `await params` (code-standards.md rule 6).

Trigger.dev task `generate-spec`: options `{ retry: { maxAttempts: 1 }, concurrency: { perKey: 1 }, maxDuration: 300 }`; hooks `onFailure` (F17 behaviour with `SpecFailureReason`), `onSuccess`. Liveblocks: `readFlow` (F17), chat read via `getStorageDocument` or the F16 server helper `readChat(roomId, limit)` (added to `lib/chat/server.ts` in this feature). Blob: `putSpec` / `getSpec` / `del`.

Run sequence: verify → `RUNNING` + status `Starting…` → `readFlow` + caps (`Reading the diagram…`) → chat (optional) → `writeSpec` with 120 s abort (`Writing the spec…`) → `validateSpecMarkdown` (retry once with errors) → `specId = cuid()` → `putSpec` (`Saving…`) → `SpecRepo.create` (on failure: `del` + `STORE_ERROR`) → status idle + assistant message "Spec ready: <title>" → `SUCCEEDED`, output.

## Security and validation

- Trust: the client supplies only `projectId` and `includeChat`; the graph and chat come from the room via the secret key in the Trigger.dev env. The writer's output is untrusted text: size/shape validated; stored verbatim; rendered by a renderer that cannot emit raw HTML (F18-D3).
- Spec-belongs-to-project: every lookup is `findFirst({ where: { id: specId, projectId } })`; `projectId` is authorized first. `blobPath` is derived from ids (`specs/${projectId}/${specId}.md`) and stored only as a convenience; it is never read from client input and never returned.
- Download headers: `nosniff` (F15 global headers), `attachment`, ASCII-only `filename` with a `filename*` fallback; no `Content-Type` from the blob is trusted (we set it).
- Rate limit and concurrency: shared with F17 (10 runs/user/hour, one active run per project).
- Logging: `{ requestId | runId, projectId, userId, specId, blobPath }` — `blobPath` appears in server logs only.
- Secrets: Blob access from Trigger.dev needs `BLOB_READ_WRITE_TOKEN` in the Trigger.dev env (OIDC is Vercel-only) — added to the F15 inventory; route handlers on Vercel use OIDC.

## Verified library facts this design relies on

| Fact | Source URL | Date checked |
|---|---|---|
| Private store: `get(pathname, { access: 'private' })` → `{ statusCode, stream, headers, blob }`, `null` when missing; raw access needs OIDC or `BLOB_READ_WRITE_TOKEN`; delivery to browsers via your Function | https://vercel.com/docs/vercel-blob/private-storage | 2026-10-22 |
| `put(pathname, body, { access, addRandomSuffix (default false), allowOverwrite (default false → error on existing), contentType, cacheControlMaxAge })`; `del(url)`; `list({ prefix, limit, cursor })` | https://vercel.com/docs/vercel-blob/using-blob-sdk | 2026-10-22 |
| "Treat blobs as immutable"; overwrites propagate ≤ 60 s (not relevant to immutable paths) | https://vercel.com/docs/vercel-blob | 2026-10-22 |
| Advanced ops (`put`/`list`) $5/1M; Hobby 2k advanced ops/month; `del` free but rate-limited | https://vercel.com/docs/vercel-blob/usage-and-pricing | 2026-10-22 |
| Trigger.dev output ≤ 10 MB; metadata ≤ 256 KB; `schemaTask`, idempotency, concurrency as in F17 | https://trigger.dev/docs/limits , https://trigger.dev/docs/tasks/schemaTask | 2026-10-22 |
| Next.js route handlers: `await params`; `NextResponse`; no `dynamic` exports (local docs) | `node_modules/next/dist/docs/01-app/03-file-conventions/route.md` | 2026-10-22 |
| **UNVERIFIED** — `react-markdown` (10.x?) and `remark-gfm` (4.x?) versions and the exact `urlTransform` default; the HTML-escaping-without-`rehype-raw` behaviour is the library's documented design but must be re-checked at pin time, and AC-022 tests it with hostile fixtures | https://github.com/remarkjs/react-markdown (to verify) | — |
| **UNVERIFIED** — whether `@vercel/blob` `put` from a non-Vercel runtime (Trigger.dev) works with `BLOB_READ_WRITE_TOKEN` exactly as documented for "CI/outside Vercel" | https://vercel.com/docs/vercel-blob (overview says token is for outside Vercel) | 2026-10-22 (statement) / usage to confirm in T-003 |
