# F15 — Test Plan

Commands (testing-strategy.md): `npm run check` (L0 + L1/L2), `npm run build` (Cache Components validation + bundle scan), `npm run e2e` (local stack), `npm run e2e:preview` (Playwright project `preview`, `E2E_BASE_URL` = PR preview URL). Manual cases record evidence in `status.md` and under `docs/acceptance/m1/<commit>/` or `docs/perf/<commit>.md`.

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-009 | L1 | `tests/unit/request-id.test.ts` | Fake logger (`child` returns a spy logger); handler that throws `AccessError('FORBIDDEN')` | Call `withRequest(handler)(new NextRequest(...))` | 403 JSON `{ error: { code: 'FORBIDDEN', message, requestId } }`; `requestId` matches UUID v4 regex; exactly one `error`-level log call with the same `requestId` |
| TC-002 | AC-010 | L1 | `tests/unit/request-id.test.ts` | Same | Call the wrapped handler twice | Two distinct `requestId`s |
| TC-003 | AC-009 | L1 | `tests/unit/request-id.test.ts` | Handler that throws a non-typed `Error` | Call | The error propagates (not converted to JSON) — Next's own handling must see it; one `error` log line with `err.message` |
| TC-004 | AC-007 | L1 | `tests/unit/env/inventory.test.ts` | Parse the inventory table from `features/15-observability-and-deployment/02-design.md`; import the Zod schema's `.shape` from `lib/env.ts` | Compare sets; read `.env.example` | Every "validated: yes" row is a schema key; every schema key is in `.env.example`; no `.env.example` line contains a value |
| TC-005 | AC-008 | L1 | `tests/unit/env/env.test.ts` | `vi.stubEnv('CLERK_SECRET_KEY', '')`, other vars set to sentinel values, `vi.resetModules()` | `await import('@/lib/env')` | Throws; message includes `CLERK_SECRET_KEY`; message includes none of the sentinel values |
| TC-006 | AC-004 | L2 | `tests/integration/webhooks/clerk-env.test.ts` | Neon test branch; two signing secrets `whsec_A` (configured) and `whsec_B`; Svix-format signature helper from F02's tests | POST `user.updated` signed with B, then with A | B → 400, `User` row unchanged; A → 200, row updated |
| TC-007 | AC-012 | L3 | `tests/e2e/error-boundaries.spec.ts` | Local stack, `NODE_ENV=test`, dev-only throw hooks `?__f15_throw=layout|page|segment` | Visit `/editor?__f15_throw=page`; `/?__f15_throw=layout`; `/editor/{id}?__f15_throw=segment` as owner | `app/error.tsx` card with digest in `font-mono`; `global-error` document with heading + Retry; segment card with "Back to projects" |
| TC-008 | AC-013 | L3 | `tests/e2e/error-boundaries.spec.ts` | Same | Press Tab once; run axe; click "Back to projects"; visit `/editor/not-a-cuid/x` | Focus on Retry with visible ring; no serious/critical axe violations; URL `/editor`; `not-found.tsx` rendered with link to `/editor` |
| TC-009 | AC-018 | L1 | `tests/unit/fixtures/large-fixture.test.ts` | `tests/fixtures/canvas/large-500-nodes.json` | `CanvasDocumentSchema.parse`; count; `JSON.stringify(...).length`; check no two node rectangles overlap (grid guarantee) | Valid; 500 nodes, 800 edges; size < 4 MB (F13 body cap) and < 5 MB; zero overlaps |
| TC-010 | AC-017 | L3 (preview) | `tests/e2e/perf.spec.ts` | Project seeded via `PUT /api/projects/{id}/canvas` with the fixture as user A | 5 cold loads with cache disabled; measure navigation start → 500th `.react-flow__node` present | p95 < 3,000 ms; all five values printed |
| TC-011 | AC-015 | L3 (preview) | `tests/e2e/perf.spec.ts` | Same project | Install rAF sampler; `page.mouse` drag a node 400 px over 3 s; collect frame deltas | p95 < 33 ms; p50/p95/p99 printed and copied to `status.md` |
| TC-012 | AC-016 | L3 (preview) | `tests/e2e/perf.spec.ts` | Second context as user B (invited editor via API) | A drags 20 times; B samples target node rect every 16 ms; delta from A `pointerup` to first B change | p95 < 500 ms |
| TC-013 | AC-018 | L3 (preview) | `tests/e2e/perf.spec.ts` | Same | `GET /api/projects/{id}/canvas` as A | 200; `content-length` < 5,242,880 |
| TC-014 | AC-019 | L3 | `tests/e2e/security-headers.spec.ts` | Local stack and preview | `request.get('/')`, `request.get('/editor')` | All five headers present with the specified values; CSP-RO contains `img-src 'self' https://img.clerk.com` |
| TC-015 | AC-021 | L1 | `tests/unit/scripts/scan-bundle.test.ts` | Temp dir with `static/chunks/a.js` containing `pk_test_x` and `NEXT_PUBLIC_X=1`; second temp dir also containing `F15_SENTINEL_CLERK_SECRET_KEY` | Run `scanBundle(dir, env)` for each | First → exit 0; second → exit 1, output names `CLERK_SECRET_KEY`, never prints the value |
| TC-016 | AC-021 | L0 | `.github/workflows/ci.yml` job `build` | Server env vars set to sentinel values in CI | `npm run build && npm run scan:bundle` | Exit 0 |
| TC-017 | AC-024 | L1 | `tests/unit/scripts/check-pins.test.ts` | Fixture `package.json` variants: correct; `@xyflow/react: ^12`; two differing `@liveblocks/*`; `prisma: latest` | Run `checkPins(json)` | Correct → ok; each variant → one named failure |
| TC-018 | AC-022 | L0 | `.github/workflows/ci.yml` job `audit` | CI | `npm audit --audit-level=high && npm run check:pins` | Exit 0 (or documented exception) |
| TC-019 | AC-025 | L0 | `.github/workflows/ci.yml` | A PR | Observe jobs | `check`, `build`, `audit`, `e2e-on-preview` run; required checks enforced (screenshot) |
| TC-020 | AC-001, AC-002, AC-003 | Manual | `docs/runbooks/release.md` §"Preview verification" | Scratch branch with probe migration; second scratch branch with a failing migration | Open PRs; inspect build logs and Neon console | Branch `preview/<name>` exists; `Applying migration` logged; failing migration → failed deployment, prior preview still live |
| TC-021 | AC-005, AC-006 | Manual | `status.md` | Dashboards | Inspect Liveblocks environment of the preview room; inspect Blob store access; curl raw private URL unauthenticated | Development env; `private`; non-200 |
| TC-022 | AC-011 | Manual | `status.md` | Preview; user A | `PUT …/canvas` with `{}`; open Vercel runtime logs | One JSON line with `requestId`, `userId`, `projectId`, `level:"warn"`, `code:"VALIDATION"`; equals response `requestId` |
| TC-023 | AC-020 (+ `/api/csp-report` behaviour) | Manual | `status.md` | Clean browser profile on preview | Run the full acceptance-run flows; query logs for `csp.violation` | Zero first-party violations after T-010 fixes; `/api/csp-report` returns 204 for a valid report, 400 for > 8 KB or non-JSON, and never changes any data |
| TC-024 | AC-023 | Manual | `docs/runbooks/recovery.md`, `status.md` | Preview project with 5 nodes saved | (a) `deleteStorageDocument` on the room → reopen as editor; (b) `del` the snapshot → edit → wait 30 s; (c) read the "both lost" section; (d) delete a project row, create a Neon branch from before, point a scratch env at it | (a) 5 nodes restored from snapshot; (b) `canvasSavedAt` updated, `GET …/canvas` 200; (c) residual risk acknowledged; (d) row present on the restored branch |
| TC-025 | AC-014 | Manual | `status.md`, `context/decision-log.md` | Gate 5 | Owner records A or B | Line present with date; if B, T-013 authorized separately |
| TC-026 | AC-026 | Manual | `docs/runbooks/release.md` | Release candidate | Follow the procedure | Tag `m1-rcN` on the deployed commit; smoke checklist filled |
| TC-027 | AC-027 | Manual | `docs/acceptance/m1/<commit>/`, `status.md` | Two users, deployed app | Execute steps 1, 2, 3, 7, 4, 5, 6, 8 of the AC-027 script | Every row Pass with evidence file names |

## Collaboration / concurrency cases

This feature touches the room only through measurement. TC-012 (edit → remote render) and acceptance-run steps 3–6 re-exercise F05/F06/F10/F12/F13's collaboration cases on the deployed environment; those cases remain owned and automated by their features (`tests/e2e/canvas-collab.spec.ts`, `tests/e2e/canvas/10-ergonomics-collab.spec.ts`, `tests/e2e/sharing.spec.ts`, `tests/e2e/persistence.spec.ts`) and run in the `e2e-on-preview` job.

## AUTHZ-MATRIX

Not applicable: no authenticated endpoint is added. `/api/csp-report` is public by design (browsers send reports without credentials); TC-023 checks it has no side effects beyond a log line and rejects oversized/invalid bodies. The standard matrix for every existing endpoint is re-run on the preview as part of `e2e-on-preview` (owned by F03/F12/F13 test files).

## Not tested automatically, and why

- Dashboard configuration (Vercel, Neon, Clerk, Liveblocks, Blob): no API access is assumed in M1; verified manually with evidence (TC-020, TC-021).
- Log content on Vercel (TC-022): Vercel log retrieval API is not in the toolchain; manual inspection.
- Neon branch restore (TC-024 d): destructive and environment-specific; rehearsed once manually.
- Chrome performance profile: inherently manual (testing-strategy.md); the scripted numbers (TC-010–013) are the repeatable part.
- CSP enforcement: deferred (F15-D2); only report-only presence is asserted.
- The one-hour wait in acceptance step 5: performed for real on the final run; the E2E suite covers reload-restore with a simulated empty room (F13).
