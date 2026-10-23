# F18 — Implementation Plan (outline)

**Dependencies to be installed:** `react-markdown` and `remark-gfm` (versions UNVERIFIED — pin at T-001 after checking the npm registry and the "no HTML without `rehype-raw`" statement in the README), `slugify` or an in-repo `slug()` helper (prefer in-repo: 10 lines, no dependency). No new Trigger.dev or Blob packages (F17/F13). The LLM SDK is whatever F17's Gate-6 decision installed.

**Environment variables added:** Trigger.dev env only: `BLOB_READ_WRITE_TOKEN` (Trigger.dev runs outside Vercel, so OIDC is unavailable — UNVERIFIED usage confirmed in T-003). Next.js: none new. F15 inventory updated.

**Migrations:** `prisma/migrations/<ts>_project_spec/` — **requires separate authorization**.

**External-service changes (each requires separate authorization):** add `BLOB_READ_WRITE_TOKEN` to the Trigger.dev environment(s); nothing else (Blob store, Trigger.dev project, provider key exist from F13/F17).

**Pre-conditions:** F17 verified on a preview; M2 exit criterion demonstrated and the owner approved M3 (D-002); F18-D1…F18-D4 approved or amended.

| Task | Deliverable | Satisfies | Files | Done when |
|---|---|---|---|---|
| T-001 | Verify and pin the Markdown renderer: check `react-markdown`/`remark-gfm` versions and the HTML-escaping behaviour; write `tests/fixtures/specs/hostile.md`; record VERIFIED rows in 02-design.md | FR-014, F18-D3 | `features/18-…/02-design.md`, `tests/fixtures/specs/hostile.md`, `package.json` | UNVERIFIED renderer row resolved; packages pinned |
| T-002 | `ProjectSpec` model + migration; `lib/specs.ts` (`SpecRepo`, `specTitle`, `specFilename`) with unit tests for title/slug | FR-002 | `prisma/schema.prisma`, `prisma/migrations/<ts>_project_spec/`, `lib/specs.ts`, `tests/integration/db/project-spec.test.ts`, `tests/unit/lib/specs.test.ts` | AC-004 passes — **separately authorized** |
| T-003 | Blob helpers: `putSpec`, `getSpec`, `deleteSpecsForProject` in `lib/blob.ts`; confirm `put` from a plain Node process with `BLOB_READ_WRITE_TOKEN` against a test store (½-day spike, result into 02-design.md) | FR-007, FR-017 | `lib/blob.ts`, `tests/integration/blob-specs.test.ts` (skipped without token) | helpers round-trip a file; UNVERIFIED row resolved |
| T-004 | Writer contract and fake: `lib/ai/spec-schemas.ts` (`SpecWriterInputSchema`, `validateSpecMarkdown`, `SPEC_LIMITS`), `lib/ai/spec-writer.ts`, `lib/ai/fake-spec-writer.ts`, `lib/ai/spec-input.ts` (graph + chat → input with truncation) | FR-005, FR-006 | `lib/ai/spec-*.ts`, `lib/ai/fake-spec-writer.ts`, `tests/unit/lib/ai/spec-*.test.ts` | AC-007, AC-008, AC-009 (validator half) pass |
| T-005 | `readChat(roomId, limit)` added to F16 `lib/chat/server.ts` | FR-005 | `lib/chat/server.ts`, `tests/integration/chat-transport.test.ts` (new case) | returns last N validated messages |
| T-006 | `trigger/generate-spec.ts` orchestration + hooks; sequence unit tests with all seams mocked (ordered put → create; del on failure; reasons) | FR-003, FR-004, FR-006, FR-007, FR-008, FR-009 | `trigger/generate-spec.ts`, `tests/unit/trigger/generate-spec.sequence.test.ts` | AC-009 (task half), AC-010, AC-011, AC-012, AC-014 pass |
| T-007 | Task integration tests on the dev server + test Blob store (unauthorized, empty, too large, success) | FR-003, FR-004, FR-009 | `tests/integration/trigger/generate-spec.test.ts`, `tests/fixtures/canvas/large-301-nodes.json` | AC-005, AC-006, AC-013 pass |
| T-008 | `POST /api/ai/spec` reusing F17's rate limit, active-run check, `TaskRunRepo`, `createRunToken` (refactor shared pieces into `lib/ai/start-run.ts` used by both routes) | FR-001 | `app/api/ai/spec/route.ts`, `lib/ai/start-run.ts`, `app/api/ai/design/route.ts` (refactor only), `tests/integration/api/ai-spec*.test.ts` | AC-001, AC-002, AC-003 pass; F17 AUTHZ tests still green |
| T-009 | Read routes: list, content, download (+ slug/`filename*` encoding, headers) with AUTHZ-MATRIX | FR-010, FR-011, FR-012 | `app/api/projects/[projectId]/specs/route.ts`, `…/[specId]/route.ts`, `…/[specId]/download/route.ts`, `tests/integration/api/specs*.test.ts` | AC-015…AC-018 pass |
| T-010 | Project delete extension (`deleteSpecsForProject`, best effort, logged) | FR-017 | `lib/projects/externals.ts`, `tests/integration/actions/project-delete.test.ts` | AC-024 passes |
| T-011 | Client: `hooks/useProjectSpecs.ts` (SWR 30 s, refresh triggers), `hooks/useSpecRun.ts` (shares `useDesignRun` internals), `components/ai/SpecsPanel.tsx`, `SpecListItem.tsx`, `SpecMarkdown.tsx` (component overrides: `a` → new tab + rel, `img` → alt text), `SpecPreviewDialog.tsx` | FR-013, FR-014, FR-015, FR-016 | `hooks/useProjectSpecs.ts`, `hooks/useSpecRun.ts`, `components/ai/Spec*.tsx`, `tests/unit/components/ai/Spec*.test.tsx` | AC-019…AC-022 pass |
| T-012 | E2E: spec run with fake writer, list refresh for both users, viewer preview/download, non-member 403; `BLOB_FAKE=1` in-memory `lib/blob.ts` adapter for the local stack (test-only module, never bundled in production builds — guarded by `env.NODE_ENV !== 'production'`) | FR-013…FR-015, US-5 | `tests/e2e/spec-generation.spec.ts`, `lib/blob.fake.ts` | AC-023, AC-025, AC-026 pass |
| T-013 | Provider spec writer `lib/ai/providers/<sdk>-spec.ts` + `lib/ai/spec-prompt.ts` (after F17's SDK decision; same SDK) | FR-006, D-006 | `lib/ai/providers/<sdk>-spec.ts`, `lib/ai/spec-prompt.ts` | one live local run produces a valid spec (screenshot) |
| T-014 | Live-provider check on a preview (10 runs), `docs/perf/spec-runs-<commit>.md`, bundle scan keys, `status.md` evidence | FR-006, FR-007, G-1, NFR-008 | `docs/perf/spec-runs-<commit>.md`, `scripts/scan-bundle.ts`, `status.md` | AC-027, AC-028 recorded |
| T-015 | Context updates: `security-model.md` (spec routes), `decision-log.md` (F18-D1…F18-D4), `progress-tracker.md`, F15 env inventory (`BLOB_READ_WRITE_TOKEN` in Trigger env) — `domain-model.md` already carries `sizeBytes` | FR-002, FR-010 (records) | `context/*.md`, `features/15-…/02-design.md` | Reviewer sign-off |

Order: T-001 → T-002 → T-003 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010 → T-011 → T-012 → T-013 → T-014 → T-015. T-003/T-004/T-005 are independent; T-008/T-009/T-010 are independent of each other.

## Risks touched

| ID | Risk | Mitigation |
|---|---|---|
| R-04 (variant) / R-15 (new) | Blob `put` and `ProjectSpec` insert are not atomic → orphan blob | Row only after `put`; best-effort `del` on insert failure; error log with `blobPath`; orphan sweep is a listed future task (`list({ prefix: 'specs/' })` minus rows) |
| R-09 | LLM output unusable | `validateSpecMarkdown` + one retry; failure reported; nothing stored |
| R-16 (new) | Hobby Blob quota: each spec is one advanced op; design snapshots already consume ops | F15 cost table; 10 runs/user/hour cap bounds it |
| R-17 (new) | Markdown renderer dependency ships HTML pass-through in a future major | Pinned caret-minor; AC-022 hostile fixtures run in CI on every change |

## Gate 6 notes

The detailed plan traces to T-001…T-015; T-002 (migration) and the Trigger.dev env change are named individually in the authorization. T-013 cannot start before F17's SDK decision is logged.
