# F17 — Test Plan

All automated tests run with `AI_PROVIDER=fake`; no CI job calls a live LLM. L2 uses the Neon test branch and the Liveblocks dev server; task tests call the exported `run` function of `design-agent` directly with the Trigger.dev SDK seams (`metadata`, `tasks.trigger`, `auth.createPublicToken`) stubbed at `lib/trigger.ts`. L3 starts `npx trigger.dev dev` in the Playwright global setup (local Trigger.dev dev environment, fake planner).

## Canonical prompts (`tests/fixtures/ai/prompts.json`)

| id | Prompt | Fixture plan |
|---|---|---|
| 1 | Design an e-commerce backend | 6 nodes (API gateway, Catalog, Cart, Orders, Payments, Postgres) / 7 edges |
| 2 | Create a chat app architecture | 7 nodes incl. WebSocket gateway, Presence cache (cylinder), Message store / 8 edges |
| 3 | Build a CI/CD pipeline | 8 nodes in one chain with one diamond (tests pass?) / 8 edges |
| 4 | Design a URL shortener with caching and analytics | 6 nodes incl. Redis cache (cylinder), Analytics pipeline / 6 edges |
| 5 | Sketch a video streaming platform with CDN and transcoding | 9 nodes incl. Transcoder (hexagon), CDN (pill), Object storage (cylinder) / 10 edges |

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | `tests/unit/trigger/config.test.ts`, `tests/unit/lib/env.test.ts` | import config; env without key | assert fields; parse env | fields as specified; env parse throws naming `TRIGGER_SECRET_KEY` |
| TC-002 | AC-029 | L1 | `tests/unit/lib/env.test.ts` | `AI_PROVIDER=fake`; `AI_PROVIDER=live` without key | parse env; `createPlanner(env)` | env passes in both; FakePlanner / `createPlanner` throws naming the key |
| TC-003 | AC-028 | L1 | `tests/unit/lib/ai/fixtures.test.ts` | fixtures | parse, validate, layout each plan | 5 prompts; each plan valid and placeable |
| TC-004 | AC-016 | L1 | `tests/unit/lib/ai/input.test.ts` | prompt 2,000 chars; 30 chat messages × 1,000 chars; graph with 5 nodes | `buildPlannerInput` | 20 messages × ≤ 500 chars; `existingNodeIds` = 5 ids; schema parses |
| TC-005 | AC-017 | L1 | `tests/unit/lib/ai/validate.test.ts` | each `tests/fixtures/ai/invalid/*.json` (11 cases) | `validatePlan(graph, plan)` | `ok: false` with the expected error code per case; valid fixtures → `ok: true` with refs resolved to ids |
| TC-006 | AC-018 | L1 | `tests/unit/lib/ai/layout.test.ts` | plans 1–5 × (empty graph, small-5-nodes) | `layoutPlan`; pairwise AABB check with 24 px padding; snapshot | no intersections; integer coords; origin rule; snapshots unchanged |
| TC-007 | AC-019 | L1 | `tests/unit/lib/ai/layout.test.ts` | `tests/fixtures/canvas/layout-wall.json` | `layoutPlan` | throws `LayoutError('LAYOUT_FAILED')`; shift count ≤ 50 |
| TC-008 | AC-020 | L1 | `tests/unit/lib/ai/apply.test.ts` | positioned plan 1; `MutableFlow` recorder | `applyPlan` | ordered calls; node/edge shapes exact; `applyPlan.constructor.name !== 'AsyncFunction'` |
| TC-009 | AC-013, AC-014 | L1 | `tests/unit/trigger/design-agent.sequence.test.ts` | all seams mocked; fake timers; planner delay 70 s | run task | ordered calls; presence refresh at 30 s/60 s; final `ttl: 2` |
| TC-010 | AC-023 | L1 | `tests/unit/trigger/design-agent.sequence.test.ts` | planner throws / 90 s timeout / `mutateFlow` rejects | run task; invoke `onFailure` | reason copy, idle status, presence cleared, `FAILED` + `failureReason`, error log fields |
| TC-011 | AC-017 (task half) | L1 | `tests/unit/trigger/design-agent.sequence.test.ts` | planner returns invalid plan twice | run task | second call has `validationErrors`; `INVALID_PLAN`; `mutateFlow` not called |
| TC-012 | AC-007 | L1 | `tests/unit/lib/trigger.test.ts` | spy on `auth.createPublicToken` | `createRunToken('run_1')` | scopes `{ read: { runs: ['run_1'] } }`, `expirationTime '1h'` |
| TC-013 | AC-009 | L2 | `tests/integration/db/task-run.test.ts` | migrated test branch | create rows; null `runId` twice; delete project | unique on non-null `runId` only; cascade delete |
| TC-014 | AC-002, AC-003, AC-005, AC-006, AC-010 | L2 | `tests/integration/api/ai-design.test.ts` | editor; `tasks.trigger` stub (resolve / throw); seeded `TaskRun` rows | call route with valid/invalid bodies; rate-limit and active-run seeds | 201 with row; 400s; 429 with `retryAfterSeconds`; 409 vs 201 (stale); 502 + `FAILED` row |
| TC-015 | AC-004 | L2 | `tests/integration/api/ai-design.authz.test.ts` | users: anon, non-member, viewer, editor, owner, email-only editor; archived project | AUTHZ-MATRIX | 401 / 403 / 403 / 201 / 201 / 201 (+bound) / 403 `FORBIDDEN` + `reason 'PROJECT_ARCHIVED'`; non-member and viewer 403 bodies identical |
| TC-016 | AC-008 | L2 | `tests/integration/api/ai-design-token.authz.test.ts` | runs owned by A (DESIGN, SPEC); B editor; C non-member | AUTHZ-MATRIX | 401 / 200 / 404 / 404 / 404; identical 404 bodies; SPEC run → 200 |
| TC-017 | AC-015 | L2 | `tests/integration/liveblocks-flow.test.ts` | dev-server room seeded with `small-5-nodes.json` | `readFlow`; read storage again | equals serialised fixture; storage unchanged |
| TC-018 | AC-011, AC-012 | L2 | `tests/integration/trigger/design-agent.test.ts` | rows: missing / SPEC / wrong project / requester removed / requester viewer | run task | `UNAUTHORIZED_RUN`; no `mutateFlow`; system chat message; idle |
| TC-019 | AC-021, AC-022 | L2 | `tests/integration/trigger/design-agent.test.ts` | room with `small-5-nodes`; plan 1 edited to connect to an existing node; delete that node at the `beforeApply` test hook | run task | all new nodes present; `skippedEdges: 1`; status texts in order; assistant message with counts; `SUCCEEDED`; document validates |
| TC-020 | AC-024 | L2 | `tests/integration/trigger/design-agent.test.ts` | planner returns `FAIL:` plan | run task; diff storage before/after | byte-identical |
| TC-021 | AC-025 | L3 | `tests/e2e/ai-design-run.spec.ts` | A editor, B editor, local Trigger.dev dev, fake planner | A sends prompt 1 | strip ≤ 2 s both; inputs disabled both; nodes within 60 s both, same positions; assistant bubble both; inputs enabled |
| TC-022 | AC-026 | L3 | `tests/e2e/ai-design-run.spec.ts` | seed 10 runs for A; env `AI_TOKEN_TTL_OVERRIDE=5s` (test-only) | A sends; wait for token expiry during a run | local 429 bubble for A only; one `/token` call; updates continue |
| TC-023 | AC-027 | L3 | `tests/e2e/ai-design-run.spec.ts` | after TC-021 | B drags own node, Ctrl+Z; A Ctrl+Z | only B's move reverted; agent nodes intact; A: no change |
| TC-024 | AC-031 | L0 | CI `scripts/scan-bundle.ts` | `next build` with dummy secret values | scan `.next/static` | no matches |
| TC-025 | AC-030 | Manual | `docs/perf/ai-runs-<commit>.md` | preview deployment with the Gate-6 SDK; real key | 5 prompts × 4 runs; export each document; `scripts/check-overlap.ts` | ≥ 18/20 `SUCCEEDED`, no overlaps, valid shapes/colours, p95 ≤ 60 s; run ids listed |
| TC-026 | AC-025 (NFR-003 timing step) | L3 | `tests/e2e/ai-design-run.spec.ts` | TC-021 timing | measure from A's `mutateFlow` completion (status "Done") to B's node count change | ≤ 1 s |

## Collaboration / concurrency cases (mandatory)

- Agent apply while B drags an unrelated node → B's drag unaffected; both converge (TC-021 includes B dragging during the run).
- Agent apply while B drags a node the agent connects to → edge appears; B's position wins on its own key (F17-D1 means the agent never writes that node's keys).
- Two editors send prompts within 1 s → second gets 409 (TC-014); if both pass (race), `concurrencyKey` serialises and the second run's verification sees the first `RUNNING` row → `UNAUTHORIZED_RUN` (TC-018 adds this case).
- Requester reloads mid-run → strip follows `AiStatus`; nodes still arrive (TC-021 variant: reload A after "Planning…").
- Member removed mid-run (after verification) → the run completes (the project still exists); the removed member is already kicked by F12 and sees nothing. Documented, not tested.

## AUTHZ-MATRIX

| Endpoint | anon | non-member | viewer | editor | owner | notes |
|---|---|---|---|---|---|---|
| `POST /api/ai/design` | 401 | 403 | 403 | 201 | 201 | archived → 403 `FORBIDDEN` (`PROJECT_ARCHIVED`, F03/FR-007); email-only member bound then 201 (TC-015) |
| `POST /api/ai/design/token` | 401 | 404 | 404 (not owner) | 404 unless requester | 404 unless requester | ownership, not role (TC-016) |
| Task `design-agent` (payload trust) | — | aborts | aborts | runs | runs | re-verified at run time (TC-018) |

## Not tested automatically (and why)

- Live LLM quality and the 90 % metric — needs a real provider and money; manual TC-025 with recorded evidence.
- Trigger.dev production deployment, `syncVercelEnvVars`, dashboard env — external services; checked in the F15 release procedure and the Gate-6 checklist.
- Presence TTL expiry timing on the real Liveblocks service — dev server behaviour may differ; observed manually during TC-025.
- EC-009 (task killed without hooks) — relies on F16's stale guard, tested there.
