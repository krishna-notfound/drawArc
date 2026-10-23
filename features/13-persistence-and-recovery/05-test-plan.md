# F13 — Test Plan

Layers per `context/testing-strategy.md`. L2 mocks `@vercel/blob` at the `lib/blob.ts` seam (not the SDK internals) and runs against the Neon test branch; L3 uses a real private Blob store (CI secret `BLOB_READ_WRITE_TOKEN`), the Liveblocks dev server, and the F05 `twoUsers` fixture with `NEXT_PUBLIC_E2E_HOOKS=1`.

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | `tests/unit/lib/env.test.ts` | `vi.stubEnv` | load with/without token and `VERCEL` | throws / loads; `.env.example` has key; pin `^2.8.2` |
| TC-002 | AC-002 | L1 | `tests/unit/lib/blob.test.ts` | mock `put`/`get`/`head`/`del` | call helpers; non-JSON stream | exact option objects; `null`; parsed; `BlobCorruptError` |
| TC-003 | AC-003 | L2 | `tests/integration/api/canvas-route.test.ts` | source scan + all responses captured | grep; inspect bodies | no `access: 'public'`, no blob-URL fetch, no `blob.vercel-storage.com` in any body |
| TC-004 | AC-004, AC-010 (AUTHZ-MATRIX) | L2 | same | O, E, V, S; P; `small-5-nodes` | PUT and GET as each + unauthenticated + random cuid | statuses per matrix; identical 403 bodies; pointer fields set |
| TC-005 | AC-005 | L2 | same | 7 invalid bodies | PUT as E | 422/422/422/422/422/400/400; `put` not called |
| TC-006 | AC-006 | L2 | same | P with/without `canvasBlobPath` | PUT empty with/without `allowEmpty` | 409 / 200 / 200 |
| TC-007 | AC-007 | L2 | same | `canvasSavedAt` now−4 s, now−11 s | PUT | 429 + `Retry-After: 6` / 200 |
| TC-008 | AC-008 | L2 | same | `putCanvas` rejects | PUT | 502; pointer unchanged; logged |
| TC-009 | AC-009 | L2 | same | `project.update` rejects | PUT then GET | 200 `pointerUpdated:false`; GET returns doc |
| TC-010 | AC-011 | L2 | same | no blob; `get` rejects | GET | `document:null` triple-null / 502 |
| TC-011 | AC-012 | L2 | same | blobs: `not json`, invalid doc, `schemaVersion: 99` | GET | 200 + `warning: 'SNAPSHOT_INVALID'`; logged |
| TC-012 | AC-025 | L2 | same | each `tests/fixtures/canvas/v*-*.json` | GET | `schemaVersion` current; guard: one fixture per version |
| TC-013 | AC-013, AC-014 | L1 | `tests/unit/hooks/use-autosave.test.tsx` | fake timers; mocked store + fetch | emit changes; advance 29/30 s; continuous changes; move-and-back | timing; single PUT; max-wait at 60 s; no PUT on equal hash; no dirty on mount |
| TC-014 | AC-015 | L1 | same | dirty 10 KB / 100 KB | dispatch `visibilitychange` hidden; `pagehide` | immediate PUT; keepalive only ≤ 60 KB |
| TC-015 | AC-016, AC-017 | L1 | same | fetch returns 429/409/500/403; `enabled:false` | advance timers | reschedule; idle; backoff 10/20/40; readonly stops |
| TC-016 | AC-018, AC-019 | L1 | `tests/unit/components/save-button.test.tsx` | `SaveProvider` with each status; empty store + `snapshotExists` | render; click; confirm/cancel dialog | labels; disabled; 3 s transition; viewer hidden; `allowEmpty` on confirm only |
| TC-017 | AC-020, AC-021 | L1 | `tests/unit/lib/liveblocks-flow.seed.test.ts` | `lib/liveblocks.ts` + `lib/blob.ts` mocked; fixtures `small-5-nodes`, `large-500-nodes` | empty room + doc; `canvasBlobPath: null`; room with 1 node; room with 1 edge | one `mutateFlow` with `storageKey 'flow'`, sync callback, nodes then edges in order, result flags; no calls for null pointer; no `getCanvas`/`mutateFlow` for non-empty; elapsed < 1 s |
| TC-018 | AC-028 | L3 | `tests/e2e/persistence.spec.ts` | A editor; fresh project | click `dev-add-node`; poll GET ≤ 65 s; hide tab | snapshot contains node ≤ 65 s; ≤ 3 s after hide |
| TC-019 | AC-022 | L3 | same | A with 4 nodes / 2 edges, "Saved" shown | `clearRoomStorage(P)`; A reload; read `__history.canUndo`; B open | identical ids/positions/edges on both; `canUndo` false after reload; gate timing (server log `seed.ms`) recorded |
| TC-020 | AC-023 | — | (withdrawn — D-034) | — | — | superseded by TC-025 |
| TC-021 | AC-024 | — | (withdrawn — D-034) | — | — | superseded by TC-026 |
| TC-022 | AC-026 | L2 | `tests/integration/actions/projects-room-lifecycle.test.ts` | spy `lib/blob.ts` | delete P; make `deleteCanvas` reject | called after cascade; action ok; logged |
| TC-023 | AC-027 | L1 | `tests/unit/api/webhook-backstop-guard.test.ts` | read webhook route source | assert `storageUpdated` branch | only `logger.info`; no blob/storage imports |
| TC-024 | AC-029 | L1 | `tests/unit/lib/liveblocks-flow.seed.test.ts` + `tests/unit/components/seed-warning-banner.test.tsx` | mocks: `getStorageDocument` rejects; `mutateFlow` rejects; `getCanvas` → `not json` / invalid doc; banner render with each `warning` | call `seedRoomIfEmpty`; render banner | `SEED_FAILED` ×2 with error log fields, no throw; `SNAPSHOT_INVALID` without `mutateFlow`; banner copy per warning; none when null |
| TC-025 | AC-030 | L2 | `tests/integration/liveblocks-flow.seed.test.ts` | Liveblocks dev server room (empty); `lib/blob.ts` mocked to `small-5-nodes` | `Promise.all([seedRoomIfEmpty(P), seedRoomIfEmpty(P)])`; `getStorageDocument(P)` | both resolve; ≥ 1 `seeded: true`; exactly 5 nodes / fixture edges; unique ids |
| TC-026 | AC-031 | L3 | `tests/e2e/persistence.spec.ts` | V viewer alone; snapshot exists; room cleared; second run with `LIVEBLOCKS_BASE_URL` pointed at a closed port for the gate request | V opens; (run 2) V opens, restore server, V reloads | 5 nodes ≤ 3 s, no notice; (run 2) banner + empty canvas, then 5 nodes after reload |

## Collaboration / concurrency cases (mandatory section)

| Strategy case | TC |
|---|---|
| Reload B → identical node/edge count and positions (from Storage) | F06 TC-020; here TC-019 covers the stronger case (Storage cleared → restored from Blob by the gate) |
| Two users edit → both see both | F06 TC-017; persistence adds: both editors' autosaves produce identical documents; the 10 s min-interval makes the second a 429 (TC-007 server side, TC-015 client side) |
| Disconnect B, edit, reconnect → edits appear for A | F06 TC-019; here: after reconnect, A's next autosave includes B's offline edit (asserted as a step in TC-018: B offline add → reconnect → snapshot contains it ≤ 65 s) |
| Two members open the same empty room concurrently (server-side seed idempotence) | TC-025 |
| Viewer-only room is seeded by the gate | TC-026 |
| Owner removes B while B is dirty | F05 TC-016; here: B's pending PUT after KICK returns 403 → `readonly`, no error toast (unit TC-015) |

## AUTHZ-MATRIX

| Endpoint | unauthenticated | non-member | viewer | editor | owner | missing project |
|---|---|---|---|---|---|---|
| `PUT /api/projects/[id]/canvas` | 401 | 403 | 403 | 200 | 200 | 403 (identical body to non-member) |
| `GET /api/projects/[id]/canvas` | 401 | 403 | 200 | 200 | 200 | 403 (identical body) |
| Seed (`seedRoomIfEmpty`, no endpoint — runs inside the F04 gate after `requireProjectRole(id, 'viewer')`) | never reached (gate redirects) | never reached (AccessDenied) | runs | runs | runs | never reached (AccessDenied) |

Plus: member matched by email only is bound on first call (F03 behaviour; one GET case in TC-004). The seed row is verified by F04's gate matrix (TC-015–TC-018 there) plus TC-026 here (viewer).

## Not tested automatically (and why)

- Vercel OIDC authentication to the Blob store: only exercisable on Vercel; verified by the first preview deployment (F15) and recorded in `status.md`.
- CDN staleness after overwrite: bypassed by `useCache: false` (asserted in TC-002); the ≤ 60 s propagation is a documented platform fact.
- Blob quota exhaustion / 900 ops-per-minute rate limiting: not reproducible safely; the 10 s min-interval and 30 s debounce are unit/L2-tested.
- Browser `pagehide` keepalive delivery during a real tab close: Playwright cannot observe the request after the page is gone; the request construction is unit-tested (TC-014), and the `visibilitychange` path is E2E-tested (TC-018).
- Exact 30 s/60 s timings in E2E: asserted with a 65 s upper bound only; precise timing is unit-tested with fake timers (TC-013).
- `storageUpdated` backstop: deferred (P-13-6); only its absence is guarded (TC-023).
- `mutateFlow` behaviour against the real Liveblocks cloud (vs. the dev server used in TC-025): checked once on the first preview deployment (F15 recovery rehearsal, scenario "room lost") and recorded in `status.md`.
