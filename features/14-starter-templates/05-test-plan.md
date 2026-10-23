# F14 — Test Plan

Conventions per `context/testing-strategy.md`; hooks `window.__rf`, `window.__canvasMutations`, `window.__history`, `window.__importTemplate(id)` (`NEXT_PUBLIC_E2E_HOOKS=1`). Canvas seeding for collab tests uses the palette helper from F07 or the F13 snapshot API if merged; a 5-node/4-edge seed is the standard "existing work".

## Unit cases

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | tests/unit/canvas/templates.test.ts | import `CANVAS_TEMPLATES` | inspect ids, names, descriptions, `schemaVersion` | ≥ 3; exact ids; unique names; ≤ 120 chars; `1` |
| TC-002 | AC-002 | L1 | tests/unit/canvas/templates.test.ts | `CanvasDocumentSchema` from F06 | `safeParse` each document; per-node/edge field checks | success; shapes/colours in unions; sizes > 0; handles present; labels ≤ 100 |
| TC-003 | AC-003 | L1 | tests/unit/canvas/templates.test.ts + tests/unit/canvas/layout-check.test.ts | each template; synthetic 2-node doc 30 px apart | `findOverlaps(nodes, 20)`; endpoint existence; id uniqueness | `[]` for templates; one pair for synthetic; all endpoints exist and differ; unique ids |
| TC-004 | AC-004 | L1 | tests/unit/canvas/templates.test.ts | microservices | `instantiateTemplate` ×2 | counts 9/8; id regexes; disjoint id sets; no source ids; endpoints remapped; fresh `data` references |
| TC-005 | AC-005 | L1 | tests/unit/components/editor/import-template-button.test.tsx | navbar with role owner / editor / viewer | query button | present/present/absent with the exact `aria-label` |
| TC-006 | AC-007 | L1 | tests/unit/components/editor/import-template-dialog.test.tsx | render dialog open | count cards, previews, buttons; Tab order | per AC-007 |
| TC-007 | AC-009 | L1 | tests/unit/components/editor/template-preview.test.tsx | cicd-pipeline; `vi.mock('@xyflow/react', () => { throw })` | render; inspect `viewBox`, counts, fills, `<text>` absence | per AC-009; module loads without touching the mock |
| TC-008 | AC-012, AC-015 (unit half) | L1 | tests/unit/hooks/useImportTemplate.test.tsx | mocked `useRoom().batch` (runs callback), mutations, store with 5 nodes/4 edges, `useBroadcastEvent`, `useReactFlow().fitView` | `importTemplate(microservices)`; then with empty store; then with `canEdit=false` | batch once; inside: `onDelete` once with all, `addNodes` once (9), `addEdge` ×8, in order; broadcast `{ type:'CANVAS_REPLACED', byUserId, templateName:'Microservices' }`; `fitView` once `{ duration: 200, padding: 0.2 }`; empty → no `onDelete`; viewer → nothing called |
| TC-009 | AC-017 | L1 | tests/unit/canvas/templates-fixtures.test.ts | fixture files | parse and deep-equal to source | equal for all three |
| TC-010 | AC-013 (unit half) | L1 | tests/unit/components/canvas/canvas-replaced-toast.test.tsx | mocked `useEventListener` invoking with `{ event, user }`; mocked `useSelf` | emit event from other user; emit from self | toast text `Alice replaced the diagram with "Microservices"` + "Fit view" action; no toast for self |

## End-to-end single-user (`tests/e2e/templates/14-import.spec.ts`)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-011 | AC-006 | L3 | editor | click Import | dialog "Starter templates" open, focus inside |
| TC-012 | AC-008 | L3 | widths 600/800/1100 | open dialog; count grid tracks | 1/2/3 |
| TC-013 | AC-010 | L3 | 5-node canvas; then empty canvas | Import on card → Cancel; → Escape; → Replace diagram; empty canvas Import; observe `aria-busy` | alert shown/closed with no change ×2; replaced + dialogs closed; immediate import; busy during import |

## Collaboration and concurrency cases (`tests/e2e/templates/14-import-collab.spec.ts`, mandatory)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-014 | AC-011 | L3 | A, B editors; 5/4 seed | B installs a `MutationObserver` recording `.react-flow__node` counts; A imports microservices | B's recorded counts never include 0; B at 9/8 ≤ 1 s with A's ids; A `__history.canUndo` true; record latency |
| TC-015 | AC-013 | L3 | A ("Alice"), B | A imports event-driven | B toast text + "Fit view"; A no toast; B click fits B; toast gone ≈ 6 s |
| TC-016 | AC-014 | L3 | A, B with set viewports | A imports | A fitted (all nodes within container); B viewport unchanged |
| TC-017 | AC-015 | L3 | A owner, B viewer | B: no button; `__importTemplate('microservices')`; `__canvasMutations.addNodes([...])` | absent; no batch; A unchanged after 2 s |
| TC-018 | AC-016 | L3 | A, B; 5/4 seed | A imports; A undo; A redo | both: original 5/4 with identical ids/positions/sizes/data; then template again |
| TC-019 | AC-018 | L3 | A, B; B editing label of X and dragging Y | A imports | B editor gone; no B write for X; no console errors; B shows template |
| TC-020 | AC-019 | L3 | A, B | both press Replace for different templates within 200 ms | converged ≤ 2 s; no errors; count ∈ {9, 10, 19} documented |
| TC-021 | AC-020 | L3 | A offline | A imports; reconnect | A immediate; B sees template + toast ≤ 5 s after reconnect |
| TC-022 | AC-011 (project-overview M1 acceptance step 7) | L3 | A owner, B editor | A imports a template | replaces the canvas for both (this is the automated counterpart of the manual acceptance step) |
| TC-023 | AC-021 | L2 | tests/integration/api/liveblocks-auth.test.ts (F05) | F05 suite on the same commit | run F05 AUTHZ-MATRIX | viewer row `*:read` green; run id recorded in status.md |
| TC-024 | AC-022 | Manual | preview | three previews, cards, confirmation, toast, imported diagrams at fit | screenshots | recognisable previews at 240 × 140, aligned cards, destructive confirmation, unobtrusive toast, tidy diagrams; paths in status.md |

## AUTHZ-MATRIX

No new endpoint. `AC-021` cross-references F05's Liveblocks auth matrix row "viewer receives `*:read`"; the F05 suite must be green on the same commit (recorded in status.md evidence).

## Not tested automatically (and why)

- Visual quality of previews, cards, toast (AC-022) — manual.
- Toast name resolution when `user.info.name` is missing ("Someone") — unit case in TC-010 covers the fallback branch; real-world missing names are not reproducible in E2E with Clerk test users.
- Rejection of a `broadcastEvent` from a read-only client — not relied upon, not tested.
