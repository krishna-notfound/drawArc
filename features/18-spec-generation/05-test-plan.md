# F18 — Test Plan

All automated tests use the fake spec writer (`AI_PROVIDER=fake`). L2 tests that touch Blob run against a dedicated **test** private store with `BLOB_READ_WRITE_TOKEN` from CI secrets and are skipped (not failed) when the token is absent; all other L2 tests stub `lib/blob.ts`. L3 uses `BLOB_FAKE=1` (in-memory adapter) plus the Liveblocks dev server and the local Trigger.dev dev environment.

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-007 | L1 | `tests/unit/lib/ai/spec-input.test.ts` | graph `small-5-nodes.json`; 60 chat messages × 800 chars; no chat | `buildSpecWriterInput` ×3 | 50 × ≤ 500 chars newest last; `chat` undefined when off/missing; schema parses |
| TC-002 | AC-008 | L1 | `tests/unit/lib/ai/spec-writer.test.ts` | fake writer; project "Shop" | `writeSpec(input, { signal })` | output starts `# Shop — Technical Specification`; ≥ 200 chars; `Components` lists 5 labels; `Connections` table rows = edge count |
| TC-003 | AC-009 (validator) | L1 | `tests/unit/lib/ai/spec-schemas.test.ts` | inputs: `''`, 150 chars, 600 KB, no `# `, `42`, valid | `validateSpecMarkdown` | five `ok: false` with messages; valid → `ok: true` with `sizeBytes` |
| TC-004 | AC-009 (task), AC-010, AC-011, AC-012, AC-014 | L1 | `tests/unit/trigger/generate-spec.sequence.test.ts` | seams mocked: `readFlow`, `readChat`, writer, `putSpec`, `del`, `SpecRepo`, `setAiStatus`, `appendChatMessage`, `metadata`; fake timers | scenarios: success; invalid ×2; writer throws; 120 s timeout; `put` rejects; create rejects (+ `del` ok / `del` rejects) | ordered `put` → `create`; `INVALID_SPEC` with `validationErrors` on retry; `WRITER_ERROR`; `STORE_ERROR` paths with `del` once and log fields; `FAILED` + reason + copy |
| TC-005 | AC-004 | L2 | `tests/integration/db/project-spec.test.ts` | migrated test branch | create rows; duplicate `blobPath`; delete project; delete task run | unique violation; cascade; `taskRunId` null |
| TC-006 | AC-001, AC-002 | L2 | `tests/integration/api/ai-spec.test.ts` | editor; trigger stub | valid body; four invalid bodies | 201 + row + stub args; 400s and no rows |
| TC-007 | AC-003 | L2 | `tests/integration/api/ai-spec.authz.test.ts` | anon/non-member/viewer/editor/owner; archived; 10 prior runs; active DESIGN/SPEC rows | AUTHZ-MATRIX + limits | 401/403/403/201/201/403 `PROJECT_ARCHIVED`; 429; 409; 409; non-member and viewer 403 bodies identical |
| TC-008 | AC-005, AC-006 | L2 | `tests/integration/trigger/generate-spec.test.ts` | dev-server rooms: empty; `large-301-nodes.json`; `small-5-nodes.json`; rows per case | run task | `UNAUTHORIZED_RUN` cases; `EMPTY_GRAPH`; `GRAPH_TOO_LARGE`; no `put`/row; chat messages |
| TC-009 | AC-013 | L2 (needs token) | `tests/integration/trigger/generate-spec.test.ts` | test Blob store; room `small-5-nodes.json` | run task; `get(blobPath)`; cleanup `del` | status order; metadata; assistant message; `SUCCEEDED`; blob equals output; row exists |
| TC-010 | AC-015 | L2 | `tests/integration/api/specs.test.ts` | 3 specs in P1 (t1<t2<t3), 2 in P2; 60 specs case | viewer `GET …/specs` | 3 rows desc; keys exactly `{ id, title, createdAt, sizeBytes, createdBy }`; limit 50 |
| TC-011 | AC-016 | L2 | `tests/integration/api/specs.authz.test.ts` | roles ×3 routes; cross-project `specId`; unknown id; bad cuids | AUTHZ-MATRIX | 401/403/200/200/200; 404; 404; 400; identical bodies per status |
| TC-012 | AC-017 | L2 | `tests/integration/api/specs.test.ts` | row with blob (stub returns stream) / row without blob (stub returns null) | `GET …/specs/[id]` | 200 content equal; 404 + `logger.warn` `{ specId, blobPath }` |
| TC-013 | AC-018 | L2 | `tests/integration/api/specs.test.ts` | spec titled `Café ☕ — Spec 2026-10-22 10:00` | `GET …/download` | headers exact; body equal |
| TC-014 | AC-024 | L2 | `tests/integration/actions/project-delete.test.ts` | project with 2 specs; `del` spy (ok / throws) | owner delete action | rows gone; `del` called for both paths; on throw still ok + error log |
| TC-015 | AC-019 | L1 | `tests/unit/components/ai/SpecsPanel.test.tsx` | role editor/viewer; status idle/running(DESIGN)/running(SPEC); fetch spy | render; click Generate | controls present/hidden; disabled/spinner; `POST /api/ai/spec` body; no call from ChatComposer (spy on the shared `startRun` with kind) |
| TC-016 | AC-020 | L1 | `tests/unit/components/ai/SpecsPanel.test.tsx` | list of 3 / empty | render | rows newest first with fields; empty copy |
| TC-017 | AC-021 | L1 | `tests/unit/components/ai/SpecPreviewDialog.test.tsx` | fetch resolves after 100 ms / rejects | open via click and via Enter; Esc; Retry | loading → rendered `h1/h2/table`; Download button; focus restore; error alert + retry refetch |
| TC-018 | AC-022 | L1 | `tests/unit/components/ai/SpecMarkdown.test.tsx` | `tests/fixtures/specs/hostile.md` | render; query DOM | no `script/img/iframe`; no `on*`; no `javascript:`/`data:` hrefs; literal `<script>` visible; links `_blank` + rel |
| TC-019 | AC-023, AC-025 | L3 | `tests/e2e/spec-generation.spec.ts` | A editor, B viewer; local Trigger.dev dev; `BLOB_FAKE=1` | A generates; both observe; B previews and downloads | strip ≤ 2 s both; message ≤ 60 s; lists refresh (A ≤ 2 s, B ≤ 5 s); preview headings; download event with attachment; B has no Generate button; tab switch refetch |
| TC-020 | AC-026 | L3 | `tests/e2e/spec-generation.spec.ts` | non-member C | `request.get(download URL)`; open workspace | 403, empty body; AccessDenied page |
| TC-021 | AC-028 | L0 | CI `scripts/scan-bundle.ts` | build with dummy secrets | scan | no matches |
| TC-022 | AC-027 | Manual | `docs/perf/spec-runs-<commit>.md` | preview deployment, Gate-6 SDK, five canonical diagrams imported via snapshot | 2 runs each; export specs | 10/10 `SUCCEEDED`; p95 ≤ 60 s; validator passes; human check of node coverage; ids recorded in `status.md` |
| TC-023 | AC-021 (NFR-003 timing step) | L3 | `tests/e2e/spec-generation.spec.ts` | 512 KB fake spec (`FAKE_SPEC_SIZE=512k`) | open preview; time to render | ≤ 2 s |

## Collaboration / concurrency cases (mandatory)

- Spec run while a design run is active → 409 (TC-007); the reverse (design during spec) is covered by F17's active-run check, which counts all kinds (F17 TC-014 gains a SPEC row case).
- Two editors click "Generate spec" within 1 s → second 409; race fallback by `concurrencyKey` + verification (TC-007 + F17 TC-018 pattern).
- Users edit the canvas while the spec is being written → the spec describes the graph as read at `readFlow` time; documented in the assistant message ("as of HH:mm:ss") — asserted in TC-009.
- Viewer B opens a preview while A deletes the project → B's dialog fetch returns 403/404 → error alert; B is also kicked (F12). Documented, not tested.

## AUTHZ-MATRIX

| Endpoint | anon | non-member | viewer | editor | owner | notes |
|---|---|---|---|---|---|---|
| `POST /api/ai/spec` | 401 | 403 | 403 | 201 | 201 | archived → 403 `FORBIDDEN` (`PROJECT_ARCHIVED`, F03/FR-007); 429/409 limits (TC-007) |
| `GET /api/projects/[id]/specs` | 401 | 403 | 200 | 200 | 200 | TC-011 |
| `GET …/specs/[specId]` | 401 | 403 | 200 | 200 | 200 | cross-project → 404 (TC-011) |
| `GET …/specs/[specId]/download` | 401 | 403 | 200 | 200 | 200 | cross-project → 404 (TC-011) |
| `POST /api/ai/design/token` (reused) | 401 | 404 | 404 | 404 unless requester | 404 unless requester | F17 TC-016 covers SPEC runs |
| Task `generate-spec` | — | aborts | aborts | runs | runs | TC-008 |

## Not tested automatically (and why)

- Real LLM spec quality — manual TC-022 only.
- Real Blob store in L3 — replaced by the in-memory adapter; the real SDK path is covered by TC-009 (L2, token-gated) and the F15 release smoke test (download a spec on the preview).
- Blob quota exhaustion and `del` rate limits — not reproducible; monitored via the F15 cost table.
- Orphan-blob sweep — future task; the log line from AC-012 is the only artefact.
- Browser "Save as" behaviour for `filename*` — Playwright captures the header; the OS dialog is not automated.
