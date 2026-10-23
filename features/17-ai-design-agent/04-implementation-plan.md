# F17 — Implementation Plan (outline)

**Dependencies to be installed (exact pins):** `@trigger.dev/sdk@4.7.7`, `@trigger.dev/react-hooks@4.7.7`, dev: `@trigger.dev/build@4.7.7` (for `syncVercelEnvVars`; package name/version UNVERIFIED — confirm in T-001 against https://trigger.dev/docs/deploy-environment-variables), `zod-to-json-schema` only if the Anthropic-direct option is chosen (Gate 6). The LLM SDK is **not** installed in this feature until the Gate-6 decision names it (D-006).

**Environment variables added:** Next.js server (Vercel Dev/Preview/Prod): `TRIGGER_SECRET_KEY`, `AI_PROVIDER` (`fake` default outside production), `AI_MODEL` (optional). Trigger.dev env only (dashboard / `syncVercelEnvVars`): `LIVEBLOCKS_SECRET_KEY`, `DATABASE_URL`, `AI_PROVIDER`, `AI_MODEL`, the provider key (name fixed at Gate 6; replaces F15's `LLM_API_KEY` placeholder row). `.env.example` updated. F15's env inventory rows are filled in by T-016.

**Migrations:** `prisma/migrations/<ts>_task_run/` — **requires separate authorization** (owner names it explicitly at Gate 6).

**External-service changes (each requires separate authorization):** create the Trigger.dev project (dev + prod environments), add the env vars above in the Trigger.dev dashboard, add `TRIGGER_SECRET_KEY` to Vercel (Preview/Production), obtain the provider key.

**Pre-conditions:** F16 verified; M1 acceptance run passed; F17-D1…F17-D4 approved or amended.

| Task | Deliverable | Satisfies | Files | Done when |
|---|---|---|---|---|
| T-001 | Trigger.dev setup: install SDKs, `trigger.config.ts`, `trigger/hello.ts` smoke task (deleted in T-012), `lib/env.ts` keys, `dev:trigger` script, README note on running `npx trigger.dev dev` beside `next dev`; verify `@trigger.dev/build` + `syncVercelEnvVars` naming; confirm Next.js 16 compatibility empirically (route handler triggers the smoke task locally) | FR-001, FR-020 | `trigger.config.ts`, `trigger/hello.ts`, `lib/env.ts`, `package.json`, `.env.example`, `tests/unit/lib/env.test.ts` | AC-001, AC-029 pass; smoke run visible in the Trigger.dev dashboard (screenshot in status.md) |
| T-002 | `TaskRun` Prisma model + enums + migration (F17-D3) + `lib/trigger.ts` `TaskRunRepo` | FR-005 | `prisma/schema.prisma`, `prisma/migrations/<ts>_task_run/`, `lib/trigger.ts`, `tests/integration/db/task-run.test.ts` | AC-009 passes — **separately authorized** |
| T-003 | Schemas and fixtures: `lib/ai/schemas.ts`, `tests/fixtures/ai/prompts.json` (5 prompts), `plans/1..5.json`, `invalid/*.json`, `lib/ai/fake-planner.ts`, `lib/ai/planner.ts` factory | FR-011, FR-019, FR-020 | `lib/ai/schemas.ts`, `lib/ai/planner.ts`, `lib/ai/fake-planner.ts`, `tests/fixtures/ai/**`, `tests/unit/lib/ai/fixtures.test.ts` | AC-028 passes |
| T-004 | **Spike (time-boxed ½ day):** against the Liveblocks dev server, determine `readFlow` implementation (read-only `mutateFlow` vs `getStorageDocument`), whether a no-op callback emits a storage update, whether `removeNode` removes incident edges, and that server writes are not in a client's undo history (prototype for AC-027). Record results in 02-design.md "Verified library facts" with dates. | FR-010, FR-014, FR-018 (evidence) | `features/17-…/02-design.md`, `scripts/spikes/liveblocks-flow.ts` (not shipped) | Three UNVERIFIED rows resolved |
| T-005 | Extend F13's `lib/liveblocks-flow.ts` with `readFlow`, `aiPresence`, `snapshot` (F13's `seedRoomIfEmpty`/`readFlowCounts` untouched; F13's seed tests stay green) + integration test | FR-008, FR-009, FR-010 | `lib/liveblocks-flow.ts` (F13, extended), `tests/integration/liveblocks-flow.test.ts` | AC-015 passes |
| T-006 | `lib/ai/validate.ts` (ref resolution, F17-D1 rules, caps) + unit tests over the invalid fixtures | FR-012 | `lib/ai/validate.ts`, `tests/unit/lib/ai/validate.test.ts` | AC-017 (validator half) passes |
| T-007 | `lib/ai/layout.ts` (rules 1–7) + snapshot tests + overlap checker shared with `scripts/check-overlap.ts` | FR-013 | `lib/ai/layout.ts`, `lib/ai/geometry.ts`, `scripts/check-overlap.ts`, `tests/unit/lib/ai/layout.test.ts` | AC-018, AC-019 pass |
| T-008 | `lib/ai/apply.ts` (synchronous, `MutableFlow` 1:1) + recorder tests; `lib/ai/input.ts` (planner input builder with truncation) | FR-014, FR-011 | `lib/ai/apply.ts`, `lib/ai/input.ts`, `tests/unit/lib/ai/apply.test.ts`, `tests/unit/lib/ai/input.test.ts` | AC-016, AC-020 pass |
| T-009 | `trigger/design-agent.ts` orchestration: verify → status → snapshot → presence loop → read → plan (retry once) → validate → layout → apply → report; `onFailure`/`onSuccess` hooks; metadata progress | FR-007, FR-008, FR-009, FR-011, FR-015, FR-016 | `trigger/design-agent.ts`, `tests/unit/trigger/design-agent.sequence.test.ts` | AC-011 (unit half), AC-013, AC-014, AC-023 pass |
| T-010 | Task integration tests on the dev server with the fake planner (success, drift, failure-before-apply, unauthorized) | FR-014, FR-016 | `tests/integration/trigger/design-agent.test.ts` | AC-011, AC-012, AC-021, AC-022, AC-024 pass |
| T-011 | Routes: `lib/ai/rate-limit.ts`, `app/api/ai/design/route.ts`, `app/api/ai/design/token/route.ts`, `createRunToken`; integration + AUTHZ-MATRIX tests | FR-002, FR-003, FR-004, FR-006 | `app/api/ai/design/route.ts`, `app/api/ai/design/token/route.ts`, `lib/ai/rate-limit.ts`, `lib/trigger.ts`, `tests/integration/api/ai-design*.test.ts`, `tests/unit/lib/trigger.test.ts` | AC-002…AC-008, AC-010 pass |
| T-012 | Client: `hooks/useDesignRun.ts` (`useRealtimeRun`, token re-issue, error → local system bubble), `ChatComposer` Send wiring, strip reads `metadata.progress.text` for the requester; delete `trigger/hello.ts` | FR-017 | `hooks/useDesignRun.ts`, `components/ai/ChatComposer.tsx`, `components/ai/AiStatusStrip.tsx`, `tests/unit/hooks/useDesignRun.test.tsx` | unit tests for state transitions pass |
| T-013 | E2E with fake planner + local Trigger.dev dev server: full run, 429 path, token re-issue, undo isolation | FR-017, FR-018 | `tests/e2e/ai-design-run.spec.ts`, Playwright global setup starts `trigger.dev dev` | AC-025, AC-026, AC-027 pass |
| T-014 | **Gate-6 decision: SDK selection** → provider module `lib/ai/providers/<sdk>.ts`, system prompt text in `lib/ai/prompt.ts`, env key; no other file changes | FR-011, FR-020, D-006 | `lib/ai/providers/<sdk>.ts`, `lib/ai/prompt.ts`, `lib/env.ts` | `AI_PROVIDER=<live>` runs canonical prompt 1 locally once (screenshot) |
| T-015 | Live-provider check on a preview deployment (20 runs), `scripts/check-overlap.ts` over exported documents, results in `docs/perf/ai-runs-<commit>.md` and `status.md`; F15 bundle scan extended with the new keys | FR-011, FR-013, FR-019, FR-020, G-1, G-2, NFR-008 | `docs/perf/ai-runs-<commit>.md`, `scripts/scan-bundle.ts`, `status.md` | AC-030, AC-031 recorded |
| T-016 | Context updates: `security-model.md` (rate limits already listed; add token scope), `decision-log.md` (F17-D1…F17-D4 + SDK decision), `progress-tracker.md`; F15 env inventory rows (`TRIGGER_SECRET_KEY`, provider key) — `domain-model.md` already carries `runId?`/`failureReason` | FR-005, FR-020 (records) | `context/*.md`, `features/15-…/02-design.md` | Reviewer sign-off |

Order: T-001 → T-002 → T-003 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010 → T-011 → T-012 → T-013 → T-014 → T-015 → T-016. T-006/T-007/T-008 are independent of each other and of T-005.

## Risks touched

| ID | Risk | Mitigation in this feature |
|---|---|---|
| R-01 | Same-key LWW user vs agent; undo does not rebase | F17-D1 additive-only; version snapshot before the run; AC-027 proves undo isolation |
| R-05 | `mutateFlow` semantics undocumented (timeouts, mid-callback concurrency, `updateNode` depth) | F17-D2 keeps the callback synchronous and short; T-004 spike; apply-time existence checks |
| R-09 | LLM output invalid or overlapping | Zod + semantic validator + deterministic layout + reject-and-report + one in-run retry; canonical prompt suite |
| R-13 (new) | Layout computed against a stale read: a user may place a node where the agent is about to place one | Accepted (different keys → no data loss); summary unaffected; revisit if the live check shows frequent overlaps |
| R-14 (new) | Trigger.dev Free plan: 10 concurrent Realtime connections — only requesters subscribe (others use `AiStatus`), so ≤ 1 subscription per active run | Documented; Hobby plan if > 10 concurrent runs are ever needed |

## Gate 6 notes

The detailed plan traces to T-001…T-016. T-002 (migration) and the four external-service changes are named individually in the authorization. The SDK choice (T-014) is a decision-log entry before any provider code is written.
