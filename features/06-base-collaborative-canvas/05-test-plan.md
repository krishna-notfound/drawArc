# F06 — Test Plan

Layers per `context/testing-strategy.md`. L3 uses the F05 `twoUsers` fixture (A owner, B editor seeded via `tests/factories.ts` until F12 ships) against the Liveblocks dev server; the app runs with `NEXT_PUBLIC_E2E_HOOKS=1` so `dev-add-node` and `window.__rf` exist.

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | `tests/unit/deps/react-flow-pin.test.ts` | read `package.json`, `app/globals.css` | assert pin and import order | `~12.12.0`; style import index > tailwind import index |
| TC-002 | AC-002 | L0 | `tests/unit/types/canvas.type-test.ts` | — | `expectTypeOf` tuples, sizes, `z.infer` ≡ `CanvasDocument` | `tsc` passes |
| TC-003 | AC-003 | L1 | `tests/unit/canvas/palette.test.ts` | `NODE_COLORS`, `USER_COLORS` | luminance ratio per pair; array equality | all ≥ 4.5; equal |
| TC-004 | AC-004 | L1 | `tests/unit/canvas/schema.test.ts` | fixtures | `validateDocument` each | `ok: true`, deep-equal |
| TC-005 | AC-005 | L1 | same | `small-5-nodes` + 16 mutations (table-driven) | validate each | `ok: false`; issue path/message as specified |
| TC-006 | AC-006 | L1 | `tests/unit/canvas/migrate.test.ts` | `v1-small`, `{schemaVersion:2}` | `migrate` then `validateDocument` | identity; v2 fails on `schemaVersion` |
| TC-007 | AC-007 | L1 | `tests/unit/canvas/serialize.test.ts` | nodes with runtime fields; node w/o size but `measured`; node w/o both; edge w/o handles | `toDocument` | validates; no runtime keys; measured size; default size; `right`/`left` |
| TC-008 | AC-008 | L1 | same | all fixtures | `toDocument(...fromDocument(d))` | deep-equal `d` |
| TC-009 | AC-009 | L1 | `tests/unit/components/flow-canvas.test.tsx` | mock `@liveblocks/react-flow`, `@liveblocks/react/suspense` (`useSelf`), capture `<ReactFlow>` props | render with children | arrays by reference; handlers identical; children inside; AST grep finds no local node/edge state |
| TC-010 | AC-010 | L1 | same | as TC-009 | capture hook arg and props over two renders | exact option object; prop values; `nodeTypes`/`edgeTypes` referentially stable |
| TC-011 | AC-011 | L1 | same + `tests/unit/repo/fit-view-guard.test.ts` | mock 0 then 3 nodes; spy instance; repo grep | invoke captured `onInit`; re-render with 4 nodes; grep `fitView(|fitBounds(|setViewport(` | `fitView` 0× / 1× with `{padding:0.2,maxZoom:1}`; grep hits only `flow-canvas.tsx`, `hooks/useCanvasActions.ts`, `hooks/useImportTemplate.ts` |
| TC-012 | AC-015 | L1 | same | `role: 'viewer'`; `role: 'editor'` + `canWrite:false`; `role:'editor'` + `canWrite:true` | render | false/false/true for the four props; badge present/present/absent |
| TC-013 | AC-017 | L1 | `tests/unit/components/placeholder-node.test.tsx` | render in `ReactFlowProvider` | inspect DOM; unknown shape | label fallback, aria-label, 4 handles opacity 0; warn once |
| TC-014 | AC-018 | L1 | `tests/unit/components/dev-add-node.test.tsx` | `vi.stubEnv` | click twice; production without flag | two valid `add` items; absent |
| TC-015 | AC-019 | L1 | `tests/unit/canvas/schema-freeze.test.ts` | module exports, fixture dir | assert version/migration/fixture consistency | passes at v1 |
| TC-016 | AC-012, AC-013, AC-014 | L3 | `tests/e2e/canvas-basic.spec.ts` | A alone, empty room | set viewport via `window.__rf.setViewport`; click `dev-add-node`; measure boxes/styles at 1280×800 and 700×800 | viewport unchanged; flush metrics; MiniMap breakpoint; pattern gap |
| TC-017 | AC-020 | L3 | `tests/e2e/canvas-collab.spec.ts` | A, B editors | A clicks add; both click within 100 ms | B sees node ≤ 1 s (log `performance.now` delta; assert p95 over 10 repetitions < 500 ms); two distinct nodes both sides |
| TC-018 | AC-021 | L3 | same | one node | concurrent drags (`mouse.move` steps interleaved via `Promise.all`) | identical transforms after 2 s; no console errors; final owner recorded in report |
| TC-019 | AC-022 | L3 | same | B offline | B adds; B online | A sees node ≤ 5 s after reconnect |
| TC-020 | AC-023 | L3 | same | 3 nodes, one dragged by A | B reload | counts/ids/transforms equal |
| TC-021 | AC-016 | L3 | `tests/e2e/canvas-readonly.spec.ts` | B seeded as VIEWER; one node | B drag + click; B wheel | node unchanged for A; not selected for B; viewport changed for B |
| TC-022 | AC-024 | L3 | `tests/e2e/canvas-perf-smoke.spec.ts` | `seedRoom(P, large-500-nodes)` | open; wheel pan 1 s | 500 nodes; MiniMap present; no errors |

## Collaboration / concurrency cases (mandatory section)

| Strategy case | TC |
|---|---|
| Two users edit different nodes → both see both ≤ 1 s | TC-017 (adds; moves of different nodes added as a step in TC-017 once drag is exercised) |
| Two users move the same node → converge, no divergence after 2 s | TC-018 |
| A undoes while B moved the same node (LWW) | F10 (undo UI) — references TC-018's setup |
| Disconnect B, edit, reconnect → edits appear for A | TC-019 |
| Reload B → identical | TC-020 |
| Delete node with edges while B edits label | F09/F10 |
| Owner removes B → off canvas ≤ 5 s | F05 TC-016 |

## AUTHZ-MATRIX

No new endpoints. Read-only enforcement is covered by F05's token matrix (viewer → `*:read`) and TC-021 here (UI + server rejection observed as "no change for A").

## Not tested automatically (and why)

- Visual quality of dots/MiniMap colours and the "infinite canvas" feel: manual screenshot review at 1280×800 and 390×844 recorded in `status.md` (visual criterion).
- Drag frame rate on the 500-node fixture (≥ 30 fps): F15 scripted perf test; here only a no-error smoke.
- `fitView` deferral behaviour of the `fitView` prop itself: not exercised because the design does not use the prop (P-06-2); TC-016 proves the absence of a viewport jump, which is the user-facing requirement.
- Exact Liveblocks Storage LSON layout: an implementation detail of the hook; only observable behaviour (sync, reload) is asserted.
