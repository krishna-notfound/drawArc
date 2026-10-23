# F18 — Spec generation

| Field | Value |
|---|---|
| Milestone | M3 |
| Depends on | F17 (Trigger.dev setup, `TaskRun`, token route, `readFlow`, planner factory pattern, rate limit), F16 (Specs tab shell, status transport), F13 (`lib/blob.ts` private store helpers), F03 (`requireProjectRole`, Prisma), F02 (`requireUser`) |
| Depended on by | — (F19 may later export specs; F20 decides whether share-link viewers see specs) |
| Product requirements | PRD-060, PRD-061; NFR-001, NFR-002, NFR-008, NFR-009 |
| Status | see status.md |

## Purpose

F18 turns the current diagram into a Markdown technical specification. An editor presses "Generate spec"; a Trigger.dev run reads the graph **server-side**, optionally includes recent room chat, asks an LLM to write Markdown through a provider-agnostic `writeSpec` contract, stores the result immutably in the private Blob store, and records a `ProjectSpec` row. Every member can list, preview and download specs; downloads are proxied through our route so blob paths never leave the server. It comes after F17 because it reuses the whole run pipeline (TaskRun, tokens, status strip, `readFlow`) and only adds persistence and a read UI. It is the M3 exit criterion: "a spec is generated from a real diagram, stored, listed, and downloadable only by project members."

## Problem statement and goals

- Problem: a diagram is not a hand-off artefact; teams need a written spec that reflects exactly what is on the canvas, generated without trusting the client's view of the graph, stored durably, and gated by membership.
- G-1: a spec is generated for each of the five canonical diagrams within 60 s (project-overview.md M3 metric; live check).
- G-2: list/preview/download return 401/403/404 correctly for every role (AUTHZ-MATRIX); a blob URL or pathname never appears in any response body.
- G-3: the stored file equals the generated Markdown byte-for-byte and is never overwritten (immutable path, `allowOverwrite: false`).
- G-4: a run that fails after the Blob `put` but before the row insert leaves no silently orphaned blob (best-effort delete + error log with the pathname).
- G-5: the preview renders Markdown with no HTML injection possible (sanitising renderer by construction; test with hostile fixtures).

## Scope

In scope:
- `POST /api/ai/spec` (editor+, Zod `{ projectId, includeChat? }`), `TaskRun` kind `SPEC`, token via F17's `POST /api/ai/design/token` (kind-agnostic).
- `trigger/generate-spec.ts` (verify → status → `readFlow` → cap → `writeSpec` → validate → Blob put → `ProjectSpec` row → report).
- `ProjectSpec` model + migration (separate authorization).
- `GET /api/projects/[projectId]/specs` (list), `GET …/specs/[specId]` (content JSON for preview), `GET …/specs/[specId]/download` (attachment).
- Specs tab UI: "Generate spec" button, list, preview Dialog with Markdown renderer, download buttons; status strip reuse.
- Provider-agnostic `writeSpec(input): Promise<string>` with a `FakeSpecWriter`; SDK chosen at F17's Gate-6 decision.

Out of scope / non-goals:
- Editing specs, versions/diffs of specs, regenerate-in-place — never in M3 (a new run creates a new spec).
- Deleting a single spec — later polish (project deletion cascades, F03/F15 cleanup).
- Spec export to PDF/DOCX — F19 if ever.
- Specs for share-link viewers — F20 decides.
- Storing spec content in Postgres — never (D-009).

## User stories

- US-1: As an editor, I want to generate a spec from the current diagram so that I can hand a written design to teammates.
- US-2: As any member, I want to see the list of specs with dates, open one in a preview, and download it as `.md`.
- US-3: As an editor, I want the spec to include the recent discussion from the room chat (optional toggle) so that rationale is captured.
- US-4: As a viewer, I want to read and download specs but not generate them (domain-model.md capabilities: download ✓ for viewers, start runs — only editors/owners).
- US-5 (abuse): As a non-member I must not list, preview, or download a project's specs even with a guessed `specId`; as a member of project A I must not fetch a spec of project B by mixing ids.
- US-6 (abuse): As a member I must not be able to make the generator describe a graph other than the room's (the task ignores any client-supplied nodes/edges).

## Key decisions referenced

- D-006 (SDK deferred — reused from F17's Gate-6 decision), D-009 (Blob for spec files, immutable `specs/{projectId}/{specId}.md`; Postgres pointer), D-022 (`useCache: false` not required for immutable paths — reads may use the default cache), F16-D1 (status transport), F17-D3 (`TaskRun.runId` nullable), security-model.md "Snapshot and artifact access" (private reads proxied; pathnames from ids we own).
- **PROPOSED F18-D1 — Graph is read server-side only; the request carries no nodes/edges.** The reference prompt 27 accepted `nodes`/`edges` from the client; we reject that (NFR-001, US-6).
- **PROPOSED F18-D2 — One active run per project across kinds.** A spec run and a design run cannot overlap (the F17 active-run check and `concurrencyKey = projectId` apply to both kinds). Rationale: the status strip shows one status; a spec generated mid-design-run would describe a half-written diagram.
- **PROPOSED F18-D3 — Markdown renderer: `react-markdown` + `remark-gfm`, no `rehype-raw`.** Raw HTML in the Markdown is rendered as escaped text because `react-markdown` builds React elements (no `dangerouslySetInnerHTML`) and only enables HTML pass-through when `rehype-raw` is added; its default `urlTransform` drops `javascript:`/`data:` URLs. Alternatives rejected: `marked` + `DOMPurify` (needs `innerHTML`, two libraries to keep in sync); server-side rendering to HTML (same sanitising burden, no benefit). Versions UNVERIFIED — pin at Gate 6.
- **PROPOSED F18-D4 — Spec size caps:** input graph ≤ 300 nodes / ≤ 600 edges (above → `GRAPH_TOO_LARGE`, reported); output 200 chars … 512 KB; chat context ≤ 50 messages × 500 chars.

## Reference material

- context: data-ownership.md row "Generated spec content (M3)" (Blob authoritative, row rebuilt only manually; "task writes blob, then row"); domain-model.md `ProjectSpec`; security-model.md Blob rules; ui-context.md dialogs (`rounded-3xl`, backdrop blur) and Specs tab copy.
- Research (`research/services.md` §D, checked 2026-10-22): private store `get(pathname, { access: 'private' })` returns `{ stream, headers, blob }` — https://vercel.com/docs/vercel-blob/private-storage ; `put` options `addRandomSuffix` (default false), `allowOverwrite` (default false → error on existing pathname), `contentType`, `cacheControlMaxAge`; `del(url)`; `list({ prefix })` — https://vercel.com/docs/vercel-blob/using-blob-sdk ; "treat blobs as immutable" — https://vercel.com/docs/vercel-blob ; server upload bounded by the 4.5 MB function body (not relevant: the task uploads from Trigger.dev, not a function) — https://vercel.com/docs/vercel-blob/server-upload ; Hobby advanced-ops quota 2k/month (each `put` is one) — https://vercel.com/docs/vercel-blob/usage-and-pricing. `research/services.md` §C: Trigger.dev output limit 10 MB; metadata 256 KB — https://trigger.dev/docs/limits , https://trigger.dev/docs/runs/metadata (checked 2026-10-22).
- Reference prompts (intent only): `27-spec-generation-flow.md`, `28-spec-persistence-download.md`, `29-spec-ui-integration.md`.
