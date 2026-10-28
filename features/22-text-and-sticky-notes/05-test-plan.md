# F22 — Test Plan

Conventions as in `context/testing-strategy.md`; lean budget (behaviour and risk only — the schema is the data-integrity boundary for five later features, so it gets the most cases). L3 uses the Liveblocks dev server and two Clerk test users; `window.__rf`, `window.__canvasMutations`, `window.__history` hooks. The DOM measurer is injected (`measure` prop) so L1 tests stub it; real measurement is covered by L3 (AC-019) only.

## Unit and integration cases

| TC | Verifies AC | Layer | File | Setup / data | Steps | Expected |
|---|---|---|---|---|---|---|
| TC-001 | AC-001 | L1 | tests/unit/canvas/schema.test.ts | `v1-small.json`, `v2-small.json` | `validateDocument(migrate(v1))`; `migrate({schemaVersion:3})`; module exports | equals v2 fixture, ok; v3 unchanged + rejected on `schemaVersion`; `migrateV1ToV2` function; version 2 |
| TC-002 | AC-002, AC-003, AC-005 | L1 | tests/unit/canvas/schema.test.ts | `v2-kinds.json` + table of ~14 mutations (kind/field mismatches, bad colour, bad id prefix, nested frame, bad `parentId`, long `order`, `javascript:` href, sizes at min−1/min, edge style valid/invalid, edge to text/frame/line/freehand) | validate each | fixture ok; each mutation fails with the expected path; min sizes pass |
| TC-003 | AC-004 | L1 | tests/unit/canvas/color.test.ts | palette ids + `#FDE68A`, `#1E3A8A`, `#757575`, `#111114` (kind `text`), `#FFF` | `resolveColor`, `textContrastOk`, `contrastRatio` | `#000000` / `#FFFFFF` / ≥ 4.58 and ok; text-kind hex flagged but rendered; `#FFF` → neutral + one warn |
| TC-004 | AC-006 | L1 | tests/unit/canvas/templates.test.ts | three templates, factory doc | validate; fixture equality | all `schemaVersion: 2` and valid |
| TC-017 | AC-021 | L2 | tests/integration/api/canvas-route.test.ts | editor session; v1 PUT body | PUT v1 then GET; read `Project` row | 200; stored doc v2 and valid; `canvasSchemaVersion` 2 |
| TC-005 | AC-007 | L1 | tests/unit/canvas/palette.test.ts | palette with mocked `addNodeOfKind` | query buttons; click "Add text"; simulate drag-drop of sticky | 8 buttons in order; call with `'text'` + centre; sticky centred on drop |
| TC-006 | AC-008 (matching half) | L1 | tests/unit/canvas/shortcuts.test.ts | — | `matchShortcut` for `t`, `n`, `Ctrl+t`, `Shift+T`; `MUTATING` | `addText`/`addSticky`; null with modifiers; both mutating; no duplicate bindings |
| TC-007 | AC-009, AC-010, AC-013 | L1 | tests/unit/components/canvas/text-node.test.tsx | `TextNode` in minimal `<ReactFlow>`, stubbed `measure` (120×24), spies on `commitTextNode`/`onDelete` | rest render (blue, hex, empty+canEdit); type + Enter; paste 1000 chars; new node + blur; new node + Escape; label "x" → "" commit; `canEdit=false` | styles/aria as FR-009; one commit `{label,width:120,height:24}`; cap 500; delete once; delete once; delete; no editor |
| TC-008 | AC-014, AC-015 | L1 | tests/unit/components/canvas/sticky-node.test.tsx | `StickyNode` 250×250, measure stub 400 / 100 | rest render (orange, hex); commit long; commit short | background/shadow/radius/handles/aria; one replace `{label, height: 424}`; height untouched |
| TC-009 | AC-016 | L1 | tests/unit/components/node-color-toolbar.test.tsx (F08 v2's file, extended; runs after F08 v2 T-012) | store with 2 stickies (`m`), then sticky+rectangle, then sticky+frame placeholder, then 1 text | render; click L; render; render; Bold | M checked; one `updateNodesData` with `size:'l'`; text groups shown for both; text groups absent; `aria-pressed` + `bold:true` |
| TC-010 | AC-017 | L1 | tests/unit/components/canvas/reserved-kind-node.test.tsx | nodes `frame`, `image`, `zigzag` | render; dblclick; Delete | placeholder text, no handles, no editor; removable; rectangle fallback; one warn each |

## End-to-end cases (`tests/e2e/text-sticky.spec.ts`)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-011 | AC-008 | L3 | A editor, empty canvas | press `t`, type "Hello", Enter; press `n`; open F08 editor on the sticky, press `t`; press `Ctrl+T` (intercepted by the test) | text node at centre, selected, label "Hello"; sticky 250×250; no extra node while editing; no node on Ctrl+T |
| TC-012 | AC-011 | L3 | text node with a long sentence; a sticky | drag right control to 120 px; drag sticky corner to 40×40 | `width:120`, `autoWidth:false`, taller, wrapped; sticky 75×75 |

## Collaboration and concurrency cases (`tests/e2e/text-sticky-collab.spec.ts`, mandatory)

| TC | Verifies AC | Layer | Setup / data | Steps | Expected |
|---|---|---|---|---|---|
| TC-013 | AC-019 | L3 | A, B editors | A creates text "Deploy" and sticky "Idea"; A saves (F13); B reloads | B's boxes equal A's `getNode` sizes ≤ 1 s, no wrap; after save+reseed the GET document is v2 with identical nodes |
| TC-014 | AC-012 | L3 | A, B editors; text node "Keep" | A types "Changed" + Escape; A types Backspace ×2; B deletes the node while A types | "Keep" kept, no write; node present; A's editor gone, no write, no delete call, no console error |
| TC-015 | AC-018 | L3 | A owner, B viewer | B presses `t`, `n`; B calls `__canvasMutations.addNodeOfKind` | nothing on A after 2 s; no palette/toolbars for B |
| TC-016 | AC-020 | Manual | preview | hover/select text; sticky; F08 toolbar at zoom 1 and 2; four sizes; bold | screenshots in status.md |

## AUTHZ-MATRIX

Not applicable — no new route or Server Action. The F13 PUT matrix already covers role gating; TC-017 adds only the v1-body case.

## Not tested automatically (and why)

- Real DOM measurement accuracy per OS/browser — only the sync consequence is tested (TC-013: no wrap on B); exact pixel widths are not asserted.
- `document.fonts.ready` timing (EC-005) — unit asserts the await happens; the real race is not reproducible deterministically.
- Concurrent label LWW on text nodes (EC-008) — same mechanism as F08 AC-021 (already tested there); documented, not repeated.
- Undo granularity of create → auto-delete (EC-007) — documented behaviour of the existing pipeline (F08 AC-006 pattern); not repeated.
- `parentId`/`extent` sync (reserved) — F23's spike.
