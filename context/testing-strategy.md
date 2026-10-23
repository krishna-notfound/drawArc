# drawArc — Testing Strategy

> PROPOSED toolchain (D-017). Versions VERIFIED 2026-10-22. Feature specs reference the layers and commands defined here; they do not redefine them.

## Principle

The minimum toolchain that can prove the acceptance criteria. Four layers; every acceptance criterion names exactly one.

| Layer | Tool | What it proves | Where |
|---|---|---|---|
| **L0 Static** | `tsc --noEmit`, ESLint (flat config), `prisma validate` | Types, lint, schema sanity | CI on every push |
| **L1 Unit** | Vitest 5 + `@testing-library/react` 16 (jsdom) | Pure logic (schemas, migrations, serialisation, access rules, drop maths, reducers), synchronous components | `tests/unit/**`, colocated `*.test.ts` allowed |
| **L2 Integration** | Vitest against a Neon **test branch** (`DATABASE_URL_TEST`) and the Liveblocks dev server | Server Actions and route handlers with a real DB; `getProjectRole` matrix; webhook handlers; Liveblocks auth route permissions | `tests/integration/**` |
| **L3 End-to-end** | Playwright 1.64 + `@clerk/testing` + `@next/playwright` `instant()` + Liveblocks dev server (`npx liveblocks dev`, `pk_localdev`, port 1153) | User journeys, multi-user collaboration (two browser contexts with distinct Clerk sessions), reload/recovery, KICK, a11y smoke | `tests/e2e/**` |

Async Server Components cannot be unit-tested in Vitest (Next docs); anything that renders a page with auth is L3.

## Quality gate

`npm run check` = `next typegen && tsc --noEmit && eslint . && vitest run && node scripts/check-prisma.mjs` (the script runs `prisma validate` once a schema exists). Required locally before any task is reported complete and in CI on every PR. `npm run build` is run in CI (catches Cache Components violations). `npm run e2e` runs L3 against a preview deployment or local stack; required before milestone sign-off and for any feature whose criteria name L3.

Reported results must be actual command output. "Tests pass" without the run log is not acceptable (see [ai-workflow-rules.md](ai-workflow-rules.md)).

## Environment for tests

- Unit: no network, no env beyond `lib/env.ts` test defaults.
- Integration: `DATABASE_URL_TEST` points at a dedicated Neon branch reset with `prisma migrate reset --force` before the suite; Liveblocks dev server with `--no-persist`; Clerk calls mocked at the `lib/auth.ts` seam (`requireUser` injectable), **not** by mocking the SDK internals.
- E2E: two Clerk test users (`E2E_USER_A_EMAIL/PASSWORD`, `E2E_USER_B_*`) on a Clerk dev instance with Email+Password enabled; `clerkSetup()` in a Playwright project-based global setup; one `browser.newContext()` per user with its own `storageState`; `NEXT_PUBLIC_LIVEBLOCKS_BASE_URL` points to the dev server; unique room id per test (`projectId` created via the API in `beforeEach`).
- MSW is **not** adopted in M1 (Next 16 + MSW 3 compatibility is UNVERIFIED and there are no third-party HTTP calls in M1 besides SDKs we exercise for real).

## Collaboration and concurrency tests (L3, feature 05/06/10/12/13)

- Two users edit different nodes → both see both changes ≤ 1 s.
- Two users move the same node → both converge on one position (no divergence after 2 s).
- User A undoes while B has since moved the same node → document the resulting state (LWW, documented caveat); assert no crash and convergence.
- Disconnect B (`context.setOffline(true)`), B edits, reconnect → B's edits appear for A.
- Reload B → identical node/edge count and positions.
- Delete node with edges by A while B is editing its label → B's editor closes, no orphan edges.
- Owner removes B → B is off the canvas within 5 s and `GET /editor/[id]` shows AccessDenied.

## Authorization tests (L2, every feature with a route/action)

Standard matrix per endpoint: unauthenticated → 401; non-member → 403 (or AccessDenied page); viewer on a mutation → 403; editor on owner-only → 403; owner → 200. Plus: member matched by email only is bound on first call. Each feature's `05-test-plan.md` lists the endpoints and references this matrix as `AUTHZ-MATRIX`.

## Performance tests (manual + scripted, feature 15)

- Scripted: Playwright seeds 500 nodes / 800 edges via the snapshot API, measures drag frame timing with `page.evaluate(performance.now)` sampling; assert p95 frame < 33 ms.
- Manual: Chrome performance profile on the deployed preview; recorded in `status.md` with the commit hash.

## Dependency and security checks

- `npm audit --audit-level=high` in CI; failures block merge unless the owner records an exception in the decision log.
- Dependabot/Renovate is PROPOSED but not configured in M1.

## Test data

- Factories in `tests/factories.ts` (`makeUser`, `makeProject`, `makeMember`, `makeCanvasDocument`) with deterministic ids.
- Canonical canvas fixtures in `tests/fixtures/canvas/` (empty, small-5-nodes, large-500-nodes, each starter template, one per schema version for migration tests).

## Traceability

Each feature's `05-test-plan.md` lists test cases `TC-###` → `AC-###` → `FR-###`, with the layer and file path. The feature is not "verified" until every AC has a TC that has been run, with output recorded in `status.md`.
