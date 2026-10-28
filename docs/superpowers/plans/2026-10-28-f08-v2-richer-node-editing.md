# F08 v2 Richer Node Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the shipped F08 v1 node editing with Shift keep-aspect resizing, auto-grow height, per-node text options (size/align/valign/bold), border style/width, custom hex colours with a contrast guard, and one properties toolbar for every node kind — every user action still one undo step.

**Architecture:** All client-side, on top of F22's schema v2 (`data.text`, `data.border`, hex `data.color`, `resolveColor`, `measureText`, `TEXT_OPTION_KINDS`). Two new pure modules (`lib/canvas/fit-height.ts`, `lib/canvas/selection-value.ts`) feed the existing node components and the toolbar; every write still goes through `useCanvasMutations`, which gains a per-node patch function and a height write. The resize-end fit write rides inside the gesture's own Liveblocks history span (the hook pauses history on the first `resizing:true` change and resumes on `resizing:false`, and React Flow calls `onResizeEnd` before emitting that final change), so F08 adds no `history.pause/resume` of its own.

**Tech Stack:** Next.js 16, React 19, `@xyflow/react` 12.12.0 (`@xyflow/system` 0.0.83), `@liveblocks/react-flow` 3.24.4, `lucide-react` 1.61.0, Vitest 5 + Testing Library (jsdom), Playwright 1.64.

**Spec:** `features/08-node-editing/` — the "## v2 — richer node editing (2026-10-28)" sections of `00-overview.md`, `01-requirements.md` (FR-015–FR-027, EC-014–EC-023), `02-design.md`, `03-acceptance-criteria.md` (AC-025–AC-041), `04-implementation-plan.md` (T-008–T-014), `05-test-plan.md` (TC-029–TC-043); `docs/research/batch1-owner-decisions.md` lines 4–6 (adopted under D-066). v1 (FR-001–FR-014) shipped in PR #13 and is not re-planned. Consumed spec: `features/22-text-and-sticky-notes/01-requirements.md`, `02-design.md`. **No F22 implementation plan existed when this plan was written** (`docs/superpowers/plans/` holds only F00); every F22 name below comes from F22's `02-design.md` "Domain model" block — re-check them against the merged F22 code at Task 3 before writing imports.

**Branch:** `feat/f08-v2-richer-node-editing`, created from `main` **after F22 merges** (D-066 round B). Tasks 1–2 touch no F22 field; Tasks 3–9 need F22's `types/canvas.ts`, `lib/canvas/color.ts` and `lib/canvas/text-measure.ts` on `main`.

## Global Constraints

- Esc in the label editor discards the draft and the bold toggle, writes nothing (D-053, FR-020, EC-022).
- Undo is per client (D-013); a resize gesture, a drag, a label commit, a toolbar action on N nodes and a multi-node drag are each exactly one undo entry (FR-004, FR-017, FR-025, FR-026); if the T-008 spike shows the resize-end fit cannot join the gesture's step, a second step is accepted and recorded in `status.md` (owner decision 4, O-v2-5).
- Viewers see borders, text options and custom colours rendered exactly as editors do, but no toolbar, no resizer, no editor; `useCanvasMutations` guards stay the second line of defence (FR-027).
- Derived text colour for a hex fill is pure `#FFFFFF` or `#000000` from F22's `resolveColor` (D-08g); it is never stored; every filled kind renders ≥ 4.58:1 (NFR-006 ≥ 4.5:1).
- `data.color`: palette ids preferred; a hex equal (case-insensitively) to a palette fill is stored as that id; otherwise lowercase `#rrggbb` (FR-022). The hex input accepts `#abc`, `abc`, `#aabbcc`, `aabbcc` and refuses everything else with `aria-invalid="true"` (FR-023).
- Width is fixed by the user; height auto-grows downward to the content, DOM-measured (never canvas `measureText`), capped at `AUTO_GROW_MAX_HEIGHT = 480`, never auto-shrinks, written in the same change as its cause (D-08e, FR-017, FR-018). Padding 8 px each side; `fit = clamp(MIN_SIZES[kind].height, content + 16 + 2·borderWidth, 480)`.
- Shift keep-aspect is read from the resize drag's `event.sourceEvent.shiftKey` only — no window key listener; circle stays locked regardless (D-08f, FR-015). Alt-resize-from-centre (FR-016) is **DROPPED** (owner decision 5) — do not implement AC-027.
- `data.text` and `data.border` are always written as whole objects (F22 rule); effective values are `{ ...DEFAULT_TEXT[kind], ...data.text }` / `{ ...DEFAULT_BORDER[kind], ...data.border }`.
- Text sizes `TEXT_SIZE_PX = { s: 12, m: 14, l: 20, xl: 28 }`, line-height 1.3, Geist Sans only; bold = `font-weight: 600`. Border widths `1 | 2 | 3`; styles `none | solid | dashed` in the UI, `dotted` rendered (CSS `dotted`, SVG `stroke-dasharray="2 4"`) with no radio (owner decision 6). Selected node: brand colour at `max(2, width)` px, `none` → solid 2 px (FR-021).
- One `<NodeToolbar nodeId={ids} isVisible position={Position.Top} offset={12} align="center" className="nodrag nopan">` for the whole selection (D-08b); colour group always; border groups only when every selected kind is one of the six `NODE_SHAPES`; text groups only when every selected kind is in F22's `TEXT_OPTION_KINDS`; reserved-kind placeholders get no toolbar groups beyond colour (FR-024). Mixed values show no checked item and a `—` badge with `aria-label="Mixed"` (validation ruling 1b). Buttons 24 × 24 px; one row at ≥ 768 px, wraps (max 360 px) below.
- Copy (exact): tooltips "More colours", "No border", "Solid", "Dashed", "Border width: 1 px", "Small", "Medium", "Large", "Extra large", "Bold (Ctrl+B)", "Align left", "Align centre", "Align right", "Align top", "Align middle", "Align bottom"; refusal tooltip "Too low contrast"; mixed badge text "—"; hex input `aria-label="Hex colour"`, `maxLength=7`.
- No new dependencies (no Popover; `components/ui` has none). Icons from the installed `lucide-react` 1.61.0 — **VERIFIED present:** `Palette`, `Bold`, `AlignVerticalJustifyStart/Center/End`, `Square`, `SquareDashed`, `Ban`, `TextAlignStart`, `TextAlignCenter`, `TextAlignEnd`; **ABSENT:** `AlignLeft/AlignCenter/AlignRight` (spec 04 named them — use the `TextAlign*` trio).
- Code standards: no business logic in `components/`, no React in `lib/`; `import type`; exhaustive `switch` with `never`; no inline hex outside `types/canvas.ts`, `app/globals.css` and F22's `lib/canvas/color.ts`; `console.warn` only in the existing once-per-id diagnostic pattern; token utilities only.
- Test budget (testing-strategy "Test budget"): one unit file per pure helper, extend existing component/E2E files, no per-control tests; every reported result is actual command output.
- E2E: `NEXT_PUBLIC_E2E_HOOKS=1` is injected by `playwright.config.ts`; run with a per-worktree `E2E_PORT` (e.g. `E2E_PORT=3108`); two Clerk users via `tests/e2e/fixtures/two-users.ts`; `window.__rf`, `__canvasMutations`, `__history` exist, this feature adds `__rfStore` and `__rfChanges`.
- Git: five commits grouped by requirement (spike+resize → auto-grow → colour/border/text options → toolbar → e2e+docs), author and committer `krishna <krishnagtkr@gmail.com>` (verify `git config user.name`/`user.email` and recent authors first), **no `Co-Authored-By` or any AI attribution line** (owner rule), conventional messages, staged by explicit pathspec, each commit with `npm run check` green, never push, never amend.

## Review Focus

1. **A remote client must not write during another user's auto-grow (EC-017).** When A commits a long label and X grows, B's React Flow re-measures X and emits a `dimensions` change *without* `setAttributes` through `onNodesChange`; the Liveblocks hook maps it to a local `measured` only. Expected: B emits no Storage-writing change for X and `__history.canUndo()` stays false on B. Pinned in Task 8 (TC-040) by filtering `window.__rfChanges` to Storage-writing changes (`add`/`remove`/`replace`, `position` with a `position`, `dimensions` with `setAttributes`).
2. **Hex input with uppercase, whitespace, 8-digit alpha or CSS colour functions.** ` #ABC ` → `#aabbcc`; `#0F766EFF` and `rgb(15,118,110)` → refused (`aria-invalid`, nothing written); `#10233D` → stored as `blue`. Pinned in Task 5 (`normaliseColor` vectors) and Task 7 (input flow).
3. **Toolbar over mixed kinds including a text node (no border).** Rectangle + text: border groups absent, text groups present, colour present; a lone text node + hex `111114` → refused with "Too low contrast"; rectangle + `frame` placeholder: only the colour group. Pinned in Task 7.
4. **Shift pressed before the drag vs during, and held past the release (EC-014).** Shift already down at `mousedown` on a handle must lock the ratio from the first move and must not start a selection box; releasing Shift mid-drag frees the ratio; Shift+drag on the empty pane still box-selects (React Flow's default `selectionKeyCode` is `Shift` — `flow-canvas.tsx` does not override it). Pinned in Task 2 (unit: `onResizeStart` with `shiftKey: true`) and Task 8 (TC-036).
5. **Undo after auto-grow, and the no-shrink rule.** One undo after a label commit restores label *and* height; one undo (or two if the spike chose the fallback) after a width-shrinking resize restores width *and* height; shortening a label never lowers the height; a node the user dragged to 600 px stays 600 after a commit (no write). Pinned in Task 3 (fit-height vectors: content 20 → current height; height 600 → 600) and Task 8 (TC-038, TC-040).

---

### Task 1: T-008 spike — undo bracketing, height sync, E2E store hooks

**Files:**
- Modify: `components/canvas/canvas-test-hooks.tsx` (declare + expose `window.__rfStore`, `window.__rfChanges`)
- Modify: `components/canvas/flow-canvas.tsx:98-110` (record every `onNodesChange` call when `e2eHooksEnabled`)
- Modify: `features/08-node-editing/status.md` (spike results, chosen paths)

**Interfaces:**
- Consumes: `useStoreApi`, `NodeChange` from `@xyflow/react`; `e2eHooksEnabled` from `@/lib/env.public`.
- Produces: `window.__rfStore?: ReturnType<typeof useStoreApi<CanvasNode, CanvasEdge>>` and `window.__rfChanges?: NodeChange<CanvasNode>[][]` (one inner array per `onNodesChange` call, appended in call order; tests reset it with `window.__rfChanges = []`). Used by Task 8 and by the spike below.

Source-level facts already **VERIFIED** on 2026-10-28 (record them verbatim in `status.md`):

| Fact | Where |
|---|---|
| `XYResizer` `end` handler calls `onResizeEnd(event, {...prevValues})` **before** `onEnd(...)`, which emits the `{ type:'dimensions', resizing:false }` change | `node_modules/@xyflow/system/dist/esm/index.js` L3611–3613; `@xyflow/react/dist/esm/index.js` L4945–4955 |
| `useLiveblocksFlow` calls `history.pause()` on the first change with `resizing === true` and `history.resume()` on `resizing === false`; a `dimensions` change with `setAttributes: 'height'` does `node.set('height', …)` regardless of `resizing` | `node_modules/@liveblocks/react-flow/dist/lib/flow.js` L46–68 |
| `pauseHistory()` is idempotent (`if (pausedHistory === null)`); `resumeHistory()` inside a `useMutation` batch is deferred to the batch end | `node_modules/@liveblocks/core/dist/index.js` L13375–13390 |
| `ResizeControl` re-runs `resizer.update({ boundaries, keepAspectRatio, … })` in an effect keyed on those props; `destroy()` only does `selection.on('.drag', null)`; the in-flight d3 gesture keeps its closures and reads `params.keepAspectRatio` / `params.boundaries` on every move; `startValues.aspectRatio` is fixed at drag start | `@xyflow/react` L4959–4990; `@xyflow/system` L3430–3437, L3526, L3617–3619 |
| `OnResizeStart`/`OnResize`/`OnResizeEnd`/`ResizeDragEvent` are exported by `@xyflow/react`; `event.sourceEvent` is the native pointer event (`shiftKey` readable); `NodeResizerProps` is **not** exported (use `ComponentProps<typeof NodeResizer>`) | `@xyflow/react/dist/esm/index.d.ts`; `@xyflow/system/dist/esm/xyresizer/types.d.ts`; `@types/d3-drag` L321 |

Conclusion to confirm at runtime: a Storage write emitted synchronously inside `onResizeEnd` lands while the hook's pause is still active, so **F08 needs no `history.pause/resume` of its own** (the 02-design's "pause at start / resume after the fit write" is superseded; record this).

- [ ] **Step 1: Expose the store and the change log**

In `canvas-test-hooks.tsx` add to `declare global` → `interface Window`: `__rfStore?: ReturnType<typeof useStoreApi<CanvasNode, CanvasEdge>>; __rfChanges?: NodeChange<CanvasNode>[][];` and set/delete `window.__rfStore = useStoreApi<CanvasNode, CanvasEdge>()` alongside `__rf`. In `flow-canvas.tsx`, where `handlers` are built (`canWrite ? { onNodesChange, … }`), wrap when `e2eHooksEnabled`: `onNodesChange: (changes) => { (window.__rfChanges ??= []).push(changes); onNodesChange(changes); }` inside the existing `useMemo`/`useCallback` so the handler identity stays stable.

- [ ] **Step 2: Run the spike on the dev server (two browser tabs, same project, editor A in both)**

Run: `NEXT_PUBLIC_E2E_HOOKS=1 npm run dev -- -p 3108` (PowerShell: `$env:NEXT_PUBLIC_E2E_HOOKS='1'; npm run dev -- -p 3108`), open `/editor/<projectId>` in tab A and tab B, drop one rectangle in A, then in A's console:

```js
const t = (c) => window.__rfStore.getState().triggerNodeChanges(c);
const id = window.__rf.getNodes()[0].id; const before = window.__rf.getNode(id).height;
t([{ type:'dimensions', id, resizing:true,  setAttributes:true, dimensions:{ width:200, height:100 } }]);
t([{ type:'dimensions', id, resizing:true,  setAttributes:true, dimensions:{ width:220, height:100 } }]);
t([{ type:'dimensions', id, dimensions:{ width:220, height:180 }, setAttributes:'height' }]);   // the fit write, as onResizeEnd would emit it
t([{ type:'dimensions', id, resizing:false, dimensions:{ width:220, height:180 } }]);
// (b) tab B now shows height 180 within 1 s  →  window.__rf.getNode(id).height === 180 in B
window.__history.undo();
// (a) ONE undo restores { width: 180, height: before } in both tabs and window.__history.canUndo() is false
```

Expected (a): one undo restores width and height together → **path A** (fit write inside `onResizeEnd`, no F08 pause/resume). If two undos are needed → **path B** (second undo step accepted, owner decision 4): Task 2 is unchanged, Task 8 TC-038 asserts two undos. Expected (b): B renders `height: 180` → `setNodeHeight` uses a `dimensions` change; if not, it uses `replaceNode` (same signature, body only).

- [ ] **Step 3: Record the spike in `status.md`**

Under "## v2 open decisions" add "### T-008 spike (2026-10-28)" with the console transcript, the five source facts, and the chosen paths: `UNDO_PATH = A | B`, `HEIGHT_WRITE = dimensions | replace`. Mark the two UNVERIFIED rows of `02-design.md` "Verified library facts (v2)" as resolved by reference to this section (do not edit 02-design).

- [ ] **Step 4: Quality gate**

Run: `npm run check 2>&1 | tail -n 15`
Expected: `tsc` clean, ESLint clean, Vitest all green (count unchanged from `main`), `prisma validate` OK.

(No commit yet — Task 2 shares commit 1.)

---

### Task 2: Resizer modifiers — Shift keep-aspect, dynamic `minHeight`, resize-end fit write (T-009, FR-015, FR-018)

**Files:**
- Modify: `components/canvas/nodes/node-resizer.tsx`
- Modify: `hooks/useCanvasMutations.ts` (add `setNodeHeight`)
- Modify: `components/canvas/nodes/canvas-node.tsx:74` (pass `nodeId`)
- Test: `tests/unit/components/canvas/node-resizer.test.tsx` (new), `tests/unit/hooks/useCanvasMutations.test.tsx` (extend)

**Interfaces:**
- Consumes: `NodeResizer`, `useStore`, `useStoreApi`, types `OnResizeStart`, `OnResize`, `OnResizeEnd` from `@xyflow/react` (VERIFIED exports); `MIN_SIZE` (v1) — becomes `MIN_SIZES[shape]` once F22 is on `main`; `AUTO_GROW_MAX_HEIGHT` arrives in Task 3 — until then use the literal `480` with a `// TODO(Task 3)` that Task 3 removes.
- Produces:
  ```ts
  // components/canvas/nodes/node-resizer.tsx
  export interface CanvasNodeResizerProps {
    nodeId: string;
    shape: NodeShape;
    /** F22 adds these for sticky (75 × 75); default MIN_SIZES[shape] (v1: MIN_SIZE). */
    minWidth?: number;
    minHeight?: number;
    /** FR-018: fitted content height for a candidate width (Task 3's contentHeight). Absent → static minHeight, no fit write. */
    contentHeightAt?: (width: number) => number;
  }
  export function CanvasNodeResizer(props: CanvasNodeResizerProps): JSX.Element
  // hooks/useCanvasMutations.ts (CanvasMutations)
  /** Writes `height` only, outside or inside a gesture. T-008 HEIGHT_WRITE: one `dimensions` change `{ dimensions: { width: node.width, height }, setAttributes: 'height' }`, or a `replace` if the spike chose that. */
  setNodeHeight(id: string, height: number): void;
  ```
  Behaviour: `onResizeStart(e)` → `shift = e.sourceEvent.shiftKey`; `onResize(e, p)` → `shift = e.sourceEvent.shiftKey`, `floor = max(minHeight, contentHeightAt?.(p.width) ?? 0)`; `onResizeEnd(e, p)` → `fit = contentHeightAt?.(p.width)`; if `fit !== undefined && fit > p.height` → `setNodeHeight(nodeId, Math.min(fit, AUTO_GROW_MAX_HEIGHT))` **synchronously inside the callback** (before React Flow emits `resizing:false`); then `shift = false`, `floor = minHeight`. `<NodeResizer keepAspectRatio={shape === 'circle' || shift} minHeight={floor} …v1 props />`. Callbacks are `useCallback`-stable; state updates use the functional form and bail out on equal values; `contentHeightAt` must be stable from the parent.

- [ ] **Step 1: Write the failing tests**

`tests/unit/components/canvas/node-resizer.test.tsx` — mock the library resizer to capture its props:

```ts
type ResizerProps = ComponentProps<typeof NodeResizer>;
let latest: ResizerProps | undefined;
vi.mock('@xyflow/react', async (orig) => ({ ...(await orig<typeof import('@xyflow/react')>()), NodeResizer: (p: ResizerProps) => { latest = p; return null; } }));
// render <CanvasNodeResizer nodeId="rectangle_01" shape="rectangle" contentHeightAt={(w) => (w < 120 ? 150 : 40)} /> inside <ReactFlowProvider>,
// store.setState({ onNodesChange, nodesDraggable: true }) as tests/unit/hooks/useCanvasMutations.test.tsx does; seed nodeLookup with the node (width 180, height 120).
const ev = (shiftKey: boolean) => ({ sourceEvent: { shiftKey } }) as unknown as ResizeDragEvent;
it('keepAspectRatio follows sourceEvent.shiftKey from the first move; circle is always locked (AC-025, AC-026 unit half)', …)
  // onResizeStart(ev(true), p) → latest.keepAspectRatio === true; onResize(ev(false), p) → false; onResize(ev(true), p) → true; onResizeEnd(ev(true), p) → false
  // shape="circle": keepAspectRatio true before and after onResize(ev(false), p)
it('minHeight is max(32, contentHeightAt(width)) during the drag and resets after it (AC-030 prop half)', …)
  // initial latest.minHeight === 32; onResize width 100 → 150; onResize width 200 → 40 → 40; width 200 with contentHeightAt returning 10 → 32; onResizeEnd → 32
it('resize end writes the fitted height once when it exceeds the final height, never otherwise, capped at 480', …)
  // onResizeEnd(ev(false), { x:0, y:0, width:100, height:120 }) → onNodesChange called once with [{ type:'dimensions', id:'rectangle_01', dimensions:{ width:100, height:150 }, setAttributes:'height' }]  (or the replace form if HEIGHT_WRITE = replace: item.height === 150)
  // onResizeEnd(ev(false), { width:200, height:120 }) → no call; contentHeightAt returning 9999 → height 480
```

`tests/unit/hooks/useCanvasMutations.test.tsx` — add to the existing `updateNodesData` describe:

```ts
it('setNodeHeight emits one height-only change and is a no-op for a missing id or a read-only member', …)
  // writable: setNodeHeight(id, 240) → one onNodesChange call, change in the HEIGHT_WRITE form, height 240, width untouched
  // id 'missing' → no call; setup(false) → no call
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/components/canvas/node-resizer.test.tsx tests/unit/hooks/useCanvasMutations.test.tsx 2>&1 | tail -n 20`
Expected: FAIL — `setNodeHeight is not a function`; `latest.keepAspectRatio` stays `false` after Shift.

- [ ] **Step 3: Implement `setNodeHeight` in `hooks/useCanvasMutations.ts`** per the T-008 `HEIGHT_WRITE` path (`nodeLookup` read at call time, `writable()` guard, one `nodeChanges([...])` call).

- [ ] **Step 4: Implement the resizer** per the Interfaces block in `components/canvas/nodes/node-resizer.tsx`; update the doc comment (the fit write joins the gesture's paused history span because `onResizeEnd` runs before the `resizing:false` change — cite the T-008 section of `status.md`). In `canvas-node.tsx` pass `nodeId={id}`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/components/canvas/node-resizer.test.tsx tests/unit/hooks/useCanvasMutations.test.tsx 2>&1 | tail -n 12`
Expected: PASS (all cases).

- [ ] **Step 6: Quality gate and commit 1 (spike + resize)**

Run: `npm run check 2>&1 | tail -n 15` → green.

```bash
git config user.name && git config user.email   # must print krishna / krishnagtkr@gmail.com
git add components/canvas/canvas-test-hooks.tsx components/canvas/flow-canvas.tsx components/canvas/nodes/node-resizer.tsx components/canvas/nodes/canvas-node.tsx hooks/useCanvasMutations.ts tests/unit/components/canvas/node-resizer.test.tsx tests/unit/hooks/useCanvasMutations.test.tsx features/08-node-editing/status.md
git commit -m "feat(canvas): Shift keep-aspect resize, content-height floor and resize-end height write; T-008 spike record"
```

---

### Task 3: Auto-grow — `fit-height.ts`, node options, label commit with fitted height (T-010 part 1, FR-017, FR-018)

**Files:**
- Create: `lib/canvas/fit-height.ts`, `lib/canvas/node-options.ts`
- Modify: `types/canvas.ts` (add `AUTO_GROW_MAX_HEIGHT`), `components/canvas/nodes/node-resizer.tsx` (replace the Task 2 literal)
- Modify: `hooks/useCanvasMutations.ts` (`updateNodesData` accepts a patch function)
- Modify: `components/canvas/nodes/canvas-node.tsx` (shape body — or `shape-node.tsx` if F22 split it): commit path, `contentHeightAt`
- Test: `tests/unit/canvas/fit-height.test.ts` (new), `tests/unit/hooks/useCanvasMutations.test.tsx` (extend), `tests/unit/components/node-label-editor.test.tsx` (extend)

**Interfaces:**
- Consumes (F22, `types/canvas.ts`): `NodeKind`, `NODE_SHAPES`, `TEXT_OPTION_KINDS`, `TextOptions`, `BorderOptions`, `DEFAULT_TEXT`, `DEFAULT_BORDER`, `MIN_SIZES`, `TEXT_SIZE_PX`, `CanvasNodeData` (union), `CanvasNode`. (F22, `lib/canvas/text-measure.ts`): `measureText(mirror: HTMLElement, opts: { text: string; size: TextOptions['size']; bold: boolean; width?: number }): { width: number; height: number }`. Verify these names against the merged F22 code first; if a name differs, adapt the import and note it in `status.md`.
- Produces:
  ```ts
  // types/canvas.ts
  export const AUTO_GROW_MAX_HEIGHT = 480;   // D-08e; px, flow units

  // lib/canvas/node-options.ts (pure)
  export function isShapeKind(kind: string): kind is NodeShape;            // NODE_SHAPES.includes
  export function isTextOptionKind(kind: string): kind is (typeof TEXT_OPTION_KINDS)[number];
  export function effectiveText(data: CanvasNodeData): TextOptions;        // { ...DEFAULT_TEXT[kind], ...data.text }
  export function effectiveBorder(data: CanvasNodeData): BorderOptions;    // { ...DEFAULT_BORDER[kind], ...data.border }

  // lib/canvas/fit-height.ts
  export const LABEL_PADDING_PX = 8;                                         // = Tailwind p-2 per side (v1 LABEL_TYPOGRAPHY)
  export type MeasureFn = (opts: { text: string; size: TextOptions['size']; bold: boolean; width: number }) => { width: number; height: number };
  export interface FitInput { kind: NodeKind; width: number; label: string; text?: TextOptions; border?: BorderOptions }
  /** clamp(MIN_SIZES[kind].height, measure({ width: width − 2·LABEL_PADDING_PX − 2·border.width }).height + 2·LABEL_PADDING_PX + 2·border.width, AUTO_GROW_MAX_HEIGHT). Callers pass the six shape kinds only (F22's text/sticky size themselves). */
  export function contentHeight(input: FitInput, measure: MeasureFn): number;
  /** Math.max(input.height, contentHeight(input, measure)) — never shrinks (D-08e). */
  export function fitHeight(input: FitInput & { height: number }, measure: MeasureFn): number;
  /** Browser-only: a single hidden body-level mirror (created lazily, `data-slot="fit-mirror"`, position:absolute; visibility:hidden; pointer-events:none; left:-99999px) handed to F22's measureText. */
  export function getFitMirror(): HTMLElement;
  export const measureLabel: MeasureFn;                                       // (opts) => measureText(getFitMirror(), opts)

  // hooks/useCanvasMutations.ts
  export type NodePatch = { data?: Partial<CanvasNodeData>; height?: number };
  updateNodesData(ids: readonly string[], patch: Partial<CanvasNodeData> | ((node: CanvasNode) => NodePatch | null)): void;
  // fn form: null skips the node; result item = { ...node, ...(height !== undefined && { height }), data: { ...node.data, ...data } }; still ONE triggerNodeChanges call.
  ```
  Mirror note: F22 mounts its own mirror inside the node only while editing and divides by `getZoom()`; F08 must measure with no editor open (toolbar, resize end), so it owns a body-level mirror in CSS px = flow units with no zoom division. If the merged `measureText` expects the mirror to already carry typography classes, `getFitMirror()` applies `labelTypography(…)` (Task 4) before each call — decide at execution by reading `lib/canvas/text-measure.ts`, and record which in `status.md`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/canvas/fit-height.test.ts` (TC-029 / AC-028) — `measure` is a `vi.fn` returning a fixed content height and recording its `width`/`size`/`bold` argument; `rect = { kind:'rectangle', width:180, label:'x', height:80 }`:

```ts
it('adds 16 px padding and twice the border width to the measured content (AC-028)', …)
  // content 40, border { solid, 1 } → contentHeight 58; border { dashed, 3 } → 62
it('floors at MIN_SIZES[kind].height and caps at AUTO_GROW_MAX_HEIGHT (EC-016)', …)
  // content 5 → 32; content 2000 → 480; label '' with content 0 → 32
it('never shrinks: fitHeight keeps the current height when the content is shorter (D-08e)', …)
  // height 80, content 20 → 80; height 50, content 40, border 1 → 58; height 600, content 2000 → 600
it('measures at the inner width with the effective text options', …)
  // width 180 border 1 → measure width 162; width 48 border 3 → 26; no data.text → size 'm', bold false; text { size:'xl', bold:true } → 'xl', true
```

`tests/unit/hooks/useCanvasMutations.test.tsx` (TC-034 / AC-036 unit half) — add:

```ts
it('updateNodesData with a patch function writes one change set with per-node heights and skips null (AC-036)', …)
  // shapes rectangle/circle/diamond (widths 180/96/140); patch (n) => n.data.shape === 'circle' ? null : { data:{ text:{ ...DEFAULT_TEXT[n.data.shape], size:'xl' } }, height: n.width! * 2 }
  // → onNodesChange called once; changes = [replace rectangle (height 360, data.text.size 'xl'), replace diamond (height 280)]; circle absent
```

`tests/unit/components/node-label-editor.test.tsx` (AC-029 unit half) — `vi.mock('@/lib/canvas/text-measure')` so `measureText` returns `{ width, height: measured }` with a per-test `measured` variable (120 by default); add:

```ts
it('a label commit writes label and fitted height in ONE replace (AC-029 unit half)', …)
  // node 180×80, border default 1 → type 'Gateway', Enter → exactly one replace; item.height === 138 (120 + 16 + 2); item.data.label === 'Gateway'; no data.text key added
  // measured = 20 → item.height === 80 (no shrink), still one replace
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/canvas/fit-height.test.ts tests/unit/hooks/useCanvasMutations.test.tsx tests/unit/components/node-label-editor.test.tsx 2>&1 | tail -n 20`
Expected: FAIL — cannot resolve `@/lib/canvas/fit-height`; patch-function form writes `[object Function]` into data; commit item has `height: 80` with `label` changed.

- [ ] **Step 3: Implement `types/canvas.ts` `AUTO_GROW_MAX_HEIGHT`, `lib/canvas/node-options.ts`, `lib/canvas/fit-height.ts`** per the Interfaces block (`contentHeight` uses `effectiveText`/`effectiveBorder` on `{ shape: input.kind, label, text, border }`); replace the Task 2 literal in `node-resizer.tsx`.

- [ ] **Step 4: Extend `updateNodesData`** in `hooks/useCanvasMutations.ts` (type guard `typeof patch === 'function'`; keep the v1 object form byte-for-byte).

- [ ] **Step 5: Wire the shape body in `canvas-node.tsx`**: `commit(value)` → `label = value.trim()`; if unchanged → close only; else `updateNodesData([id], (node) => ({ data: { label }, height: fitHeight({ kind: node.data.shape, width: node.width!, height: node.height!, label, text: node.data.text, border: node.data.border }, measureLabel) }))`. `contentHeightAt = useCallback((width) => contentHeight({ kind: shape, width, label: data.label, text: data.text, border: data.border }, measureLabel), [shape, data.label, data.text, data.border])` passed to `<CanvasNodeResizer>`. Only shapes get `contentHeightAt` (F22's text/sticky own their sizing).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/canvas/fit-height.test.ts tests/unit/hooks/useCanvasMutations.test.tsx tests/unit/components/node-label-editor.test.tsx 2>&1 | tail -n 12`
Expected: PASS.

- [ ] **Step 7: Spike (c) — mirror accuracy on the dev server**

Run the dev server as in Task 1, drop a rectangle, commit a 6-line label (Shift+Enter ×5), then in the console: `const n = window.__rf.getNodes()[0]; const el = document.querySelector('[data-slot="node-label"]'); [n.height, el.scrollHeight / window.__rf.getZoom() + 16 + 2]`.
Expected: the two numbers differ by ≤ 1 px; repeat after `window.__canvasMutations.updateNodeData(n.id, { text: { size:'s', align:'center', valign:'middle', bold:false } })` and a re-commit, then `'l'` and `'xl'`. Record the four deltas in `status.md` (T-008 (c)).

- [ ] **Step 8: Quality gate and commit 2 (auto-grow)**

Run: `npm run check 2>&1 | tail -n 15` → green.

```bash
git add types/canvas.ts lib/canvas/fit-height.ts lib/canvas/node-options.ts hooks/useCanvasMutations.ts components/canvas/nodes/node-resizer.tsx components/canvas/nodes/canvas-node.tsx tests/unit/canvas/fit-height.test.ts tests/unit/hooks/useCanvasMutations.test.tsx tests/unit/components/node-label-editor.test.tsx features/08-node-editing/status.md
git commit -m "feat(canvas): auto-grow node height to its label on commit and resize end (cap 480, one undo step)"
```

---

### Task 4: Text options rendering — label/editor typography, vertical alignment, Ctrl+B bold draft (T-010 part 2, FR-019, FR-020)

**Files:**
- Modify: `components/canvas/nodes/node-label.tsx`, `components/canvas/nodes/node-label-editor.tsx`, `components/canvas/nodes/shape-renderer.tsx` (valign column only — border comes in Task 5), `components/canvas/nodes/canvas-node.tsx`
- Test: `tests/unit/components/node-label-editor.test.tsx` (extend)

**Interfaces:**
- Consumes: `TextOptions`, `TEXT_SIZE_PX` (F22); `effectiveText`, `fitHeight`, `measureLabel` (Task 3).
- Produces:
  ```ts
  // components/canvas/nodes/node-label.tsx
  /** Replaces LABEL_TYPOGRAPHY: class + style pair shared by the rest label and the textarea (FR-014 kept for every size). */
  export function labelTypography(text: TextOptions): { className: string; style: CSSProperties };
  //   className = 'p-2 font-sans leading-[1.3] whitespace-pre-wrap break-words w-full'
  //   style = { fontSize: TEXT_SIZE_PX[text.size], fontWeight: text.bold ? 600 : 400, textAlign: text.align }
  export interface NodeLabelProps { label: string; text: TextOptions; showPlaceholder: boolean; hidden?: boolean }
  //   rest label: no line-clamp (remove `line-clamp-5`), keep `overflow-hidden max-h-full`
  // components/canvas/nodes/node-label-editor.tsx
  export interface NodeLabelEditorProps {
    initial: string;
    text: TextOptions;                                       // effective options → typography; initial bold draft
    onCommit(value: string, options: { bold: boolean }): void;  // Enter/blur, at most once
    onCancel(): void;                                        // Escape; discards draft AND bold
  }
  //   keydown (native listener, as v1): (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' → preventDefault, toggle local bold, restyle textarea immediately
  // components/canvas/nodes/shape-renderer.tsx (addition; full props in Task 5)
  valign?: TextOptions['valign'];   // content box: flex-direction column, align-items stretch, justify-content flex-start | center | flex-end (default 'middle' = v1 look)
  ```
  `canvas-node.tsx`: `text = effectiveText(data)`; `commit(value, { bold })` → `textChanged = bold !== text.bold`; no-op when label unchanged and `!textChanged`; else one `updateNodesData([id], (node) => ({ data: { label, ...(textChanged && { text: { ...effectiveText(node.data), bold } }) }, height: fitHeight({ …, label, text: nextText }, measureLabel) }))`. The editor overlay keeps `absolute inset-0` but becomes `flex flex-col` with the same `justify-content` as the shape (no visual jump, FR-014). If F22 already added a typography prop to `NodeLabelEditor` for its text/sticky nodes, fold it into `text` and update F22's two call sites — one source of truth.

- [ ] **Step 1: Write the failing tests** (TC-030 / AC-031, AC-041) in `tests/unit/components/node-label-editor.test.tsx`:

```ts
it('renders data.text at rest and in the editor: 28 px / 600 / left / flex-end; absent text equals v1 (AC-031)', …)
  // node with data.text { size:'xl', align:'left', valign:'bottom', bold:true }: [data-slot="node-label"] toHaveStyle({ fontSize:'28px', fontWeight:'600', textAlign:'left' }); its closest('[data-shape]') toHaveStyle({ justifyContent:'flex-end' })
  // dblclick → textarea toHaveStyle same font-size/weight/align
  // node without data.text: 14px / 400 / center; [data-shape] justifyContent 'center'
it('Ctrl+B then Enter writes text.bold with the label in one replace; Ctrl+B then Escape writes nothing (AC-041, EC-022)', …)
  // type 'Title', keyboard '{Control>}b{/Control}' → textarea toHaveStyle({ fontWeight:'600' }); '{Enter}' → one replace with data.label 'Title', data.text equal { ...DEFAULT_TEXT.rectangle, bold:true }, height present
  // reopen, '{Control>}b{/Control}{Escape}' → no replace; label unchanged
it('Ctrl+B with an unchanged label still commits (bold alone is a change)', …)
  // dblclick, Ctrl+B, Enter → one replace with text.bold true
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/components/node-label-editor.test.tsx 2>&1 | tail -n 20`
Expected: FAIL — font-size 14px where 28px expected; Ctrl+B writes nothing.

- [ ] **Step 3: Implement** `labelTypography`, `NodeLabel`, `NodeLabelEditor` (bold draft + `text` prop), `ShapeRenderer` `valign`, and the `canvas-node.tsx` commit path per the Interfaces block. Replace every `LABEL_TYPOGRAPHY` import (grep `LABEL_TYPOGRAPHY` — F22's text/sticky nodes may import it; switch them to `labelTypography(effectiveText(data))`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/components/node-label-editor.test.tsx tests/unit/components 2>&1 | tail -n 12`
Expected: PASS, including F22's `text-node`/`sticky-node` suites.

(Commit 3 after Task 5.)

---

### Task 5: Borders and custom colours in the renderer; `normaliseColor` and recent colours (T-011, FR-021, FR-022)

**Files:**
- Modify: `components/canvas/nodes/shape-renderer.tsx`, `components/canvas/nodes/canvas-node.tsx` (pass `border`, `valign`, raw `color`), `components/canvas/shape-drag-ghost.tsx` only if its `ShapeRenderer` call no longer type-checks (ghost visuals unchanged)
- Modify: `lib/canvas/color.ts` (F22's — add `normaliseColor`)
- Create: `lib/canvas/recent-colors.ts`
- Test: `tests/unit/components/canvas/shape-renderer.test.tsx` (new), `tests/unit/canvas/color.test.ts` (F22's — extend), `tests/unit/canvas/recent-colors.test.ts` (new, small)

**Interfaces:**
- Consumes (F22): `resolveColor(color): { fill; text; custom }`, `isHexColor`, `contrastRatio`, `textContrastOk`, `NODE_COLORS`, `NODE_COLOR_IDS`, `NodeColor`, `HexColor`, `BorderOptions`.
- Produces:
  ```ts
  // components/canvas/nodes/shape-renderer.tsx
  export interface ShapeRendererProps {
    shape: NodeShape;
    color: NodeColor;                       // id or hex; fill/text via resolveColor (never raw CSS text)
    border?: BorderOptions;                 // default DEFAULT_BORDER[shape] = { solid, 1 }
    valign?: TextOptions['valign'];         // Task 4
    selected?: boolean; ghost?: boolean; children?: ReactNode; className?: string;
  }
  // outline(border, selected, ghost) → { color, width, style: 'solid'|'dashed'|'dotted'|'none' }
  //   ghost: brand, 1, dashed (v1 dash '4 3' on SVG) — unchanged
  //   selected: var(--accent-primary), max(2, border.width), border.style === 'none' ? 'solid' : border.style
  //   rest: var(--border-default), border.width, border.style
  // CSS shapes: border: `${width}px ${style === 'none' ? 'solid' : style} ${style === 'none' ? 'transparent' : color}` (box size stable)
  // SVG shapes: strokeWidth = width; stroke = style === 'none' ? 'none' : 'currentColor'; strokeDasharray: dashed '6 4', dotted '2 4', solid undefined; vectorEffect non-scaling-stroke (v1); data-border-style attribute on the <svg> for tests

  // lib/canvas/color.ts (additive)
  /** Trims, accepts `#abc` | `abc` | `#aabbcc` | `aabbcc` (any case), expands and lower-cases; a hex equal to a NODE_COLORS fill (case-insensitive) → that id; anything else → null. */
  export function normaliseColor(input: string): NodeColor | null;

  // lib/canvas/recent-colors.ts (browser storage, no React)
  export const RECENT_COLORS_KEY = 'drawarc:recent-colors';
  export const RECENT_COLORS_MAX = 5;
  export function readRecentColors(storage?: Storage | null): HexColor[];              // try/catch; JSON array filtered by isHexColor; ≤ 5; [] on any error
  export function pushRecentColor(hex: HexColor, storage?: Storage | null): HexColor[]; // dedupe, prepend, slice(0, 5), write in try/catch; returns the new list even if the write failed
  // `storage` defaults to globalThis.localStorage read INSIDE the try (private mode may throw on access)
  ```
  `canvas-node.tsx`: `knownVisuals` (or F22's `kindOf`) treats `isHexColor(data.color)` as known; pass `color={data.color}`, `border={effectiveBorder(data)}`, `valign={text.valign}`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/components/canvas/shape-renderer.test.tsx` (TC-031 / AC-032):

```ts
it('renders border style and width on CSS and SVG shapes (AC-032)', …)
  // rectangle { dashed, 3 } → [data-shape=rectangle] toHaveStyle({ borderWidth:'3px', borderStyle:'dashed' })
  // hexagon { dashed, 3 } → polygon attributes stroke-width '3', stroke-dasharray '6 4'; { dotted, 2 } → '2 4'; { solid, 1 } → no stroke-dasharray
it('none hides the outline at rest but shows a 2 px solid brand outline when selected (FR-021, NFR-006)', …)
  // rectangle { none, 1 } → borderColor transparent, borderWidth 1px; selected → borderWidth 2px, borderStyle solid, borderColor 'var(--accent-primary)'
  // hexagon { none, 1 } → polygon stroke 'none'; selected → stroke-width '2', no dasharray
it('selected keeps the style and uses max(2, width) (FR-021)', …)
  // rectangle { dashed, 3 } selected → 3px dashed brand; { dashed, 1 } selected → 2px dashed
it('a hex colour fills the shape and derives pure white or black text (FR-022)', …)
  // color '#0f766e' → background rgb(15,118,110), color rgb(255,255,255); '#fde68a' → color rgb(0,0,0); 'blue' → NODE_COLORS.blue pair
```

`tests/unit/canvas/color.test.ts` (TC-032 / AC-033, EC-018) — add a `describe('normaliseColor (F08 v2)')`:

```ts
it.each([['#FFF','#ffffff'],['fff','#ffffff'],['#FFFFFF','#ffffff'],[' #ABC ','#aabbcc'],['#10233D','blue'],['0f766e','#0f766e'],['#0f766e','#0f766e']])('%s → %s', …)
it.each(['red','#12345','#0F766EFF','rgb(15,118,110)','','#'])('refuses %s', (v) => expect(normaliseColor(v)).toBeNull())
it('every palette fill round-trips to its id', …)   // for id of NODE_COLOR_IDS: normaliseColor(NODE_COLORS[id].fill.toUpperCase()) === id
it('1 000 seeded random hexes all derive a pure pair at ≥ 4.58:1 and pass textContrastOk for every filled kind (D-08g)', …)
  // mulberry32(42); for each: const { fill, text } = resolveColor(hex); expect(['#FFFFFF','#000000']).toContain(text); expect(contrastRatio(fill, text)).toBeGreaterThanOrEqual(4.58); for kind of ['rectangle','sticky'] expect(textContrastOk(kind, hex)).toBe(true)
  // expect(textContrastOk('text', '#111114')).toBe(false)
```

`tests/unit/canvas/recent-colors.test.ts` (EC-019):

```ts
it('keeps the five most recent, most recent first, without duplicates', …)   // push #000001…#000006 → ['#000006','#000005','#000004','#000003','#000002']; push '#000004' again → moves to front, length 5
it('ignores malformed storage and swallows storage errors', …)              // getItem returns '{"x":1}' → []; a Storage whose getItem/setItem throw → read [] and push returns [hex]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/components/canvas/shape-renderer.test.tsx tests/unit/canvas/color.test.ts tests/unit/canvas/recent-colors.test.ts 2>&1 | tail -n 20`
Expected: FAIL — `normaliseColor`/`recent-colors` missing; rectangle renders `1px solid`.

- [ ] **Step 3: Implement** `ShapeRenderer` borders, `normaliseColor`, `lib/canvas/recent-colors.ts`, and the `canvas-node.tsx` wiring per the Interfaces block.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/components/canvas tests/unit/canvas 2>&1 | tail -n 12`
Expected: PASS (F22's `color.test.ts` cases still green).

- [ ] **Step 5: Quality gate and commit 3 (colour / border / text options)**

Run: `npm run check 2>&1 | tail -n 15` → green.

```bash
git add components/canvas/nodes/node-label.tsx components/canvas/nodes/node-label-editor.tsx components/canvas/nodes/shape-renderer.tsx components/canvas/nodes/canvas-node.tsx lib/canvas/color.ts lib/canvas/recent-colors.ts tests/unit/components/node-label-editor.test.tsx tests/unit/components/canvas/shape-renderer.test.tsx tests/unit/canvas/color.test.ts tests/unit/canvas/recent-colors.test.ts
# plus any F22 file whose LABEL_TYPOGRAPHY / ShapeRenderer call you had to adapt (list them in the commit body)
git commit -m "feat(canvas): per-node text options, border style/width and hex colours with derived text contrast"
```

---

### Task 6: Mixed-value reducer and `useSelectionValue` (T-012 part 1, FR-024 NFR-004)

**Files:**
- Create: `lib/canvas/selection-value.ts`
- Modify: `hooks/useSelectedNodeIds.ts` (add `useSelectionValue`; delete `useSelectionColor` once nothing imports it — grep)
- Test: `tests/unit/canvas/selection-value.test.ts` (new)

**Interfaces:**
- Produces:
  ```ts
  // lib/canvas/selection-value.ts (pure)
  export const MIXED: unique symbol;                         // Symbol('mixed')
  export type Shared<T> = T | typeof MIXED;
  /** Object.is equality over primitives; empty → undefined; one distinct value → it; else MIXED. */
  export function sharedValue<T extends string | number | boolean>(values: Iterable<T>): Shared<T> | undefined;

  // hooks/useSelectedNodeIds.ts
  /** pick runs per selected node on the store's nodeLookup (narrow selector, NFR-004); nodes missing from the lookup are skipped. */
  export function useSelectionValue<T extends string | number | boolean>(ids: readonly string[], pick: (data: CanvasNodeData) => T): Shared<T> | undefined;
  ```
  Toolbar usage (Task 7): `useSelectionValue(ids, (d) => isShapeKind(d.shape)) === true` → border groups; `=== true` for `isTextOptionKind` → text groups.

- [ ] **Step 1: Write the failing test** `tests/unit/canvas/selection-value.test.ts`:

```ts
it.each([
  [[], undefined], [['m'], 'm'], [['m','m'], 'm'], [['m','l'], MIXED],
  [[1,1], 1], [[1,1,2], MIXED], [[true,true], true], [[false,true], MIXED], [['blue','#0f766e'], MIXED],
])('sharedValue(%j) → %s', (values, expected) => expect(sharedValue(values)).toBe(expected));
```

- [ ] **Step 2: Run the test to verify it fails** — `npx vitest run tests/unit/canvas/selection-value.test.ts 2>&1 | tail -n 8` → FAIL (module missing).

- [ ] **Step 3: Implement** `selection-value.ts` and `useSelectionValue` (generalise the v1 `useSelectionColor` loop; `useCallback` selector keyed on `ids` and `pick`; `useStore(select)` with the reducer applied to the picked values). Switch the v1 toolbar's `useSelectionColor(ids)` to `useSelectionValue(ids, (d) => d.color)` (`MIXED`/`undefined` → "nothing checked", as `null` was) and delete `useSelectionColor` — nothing else in the toolbar changes until Task 7.

- [ ] **Step 4: Run the tests to verify they pass** — `npx vitest run tests/unit/canvas/selection-value.test.ts tests/unit/components/node-color-toolbar.test.tsx 2>&1 | tail -n 8` → PASS (v1 toolbar cases unchanged).

(Commit 4 after Task 7.)

---

### Task 7: Properties toolbar with hex input (T-012 parts 2–3, FR-023, FR-024, FR-025)

**Files:**
- Create: `components/canvas/node-hex-input.tsx`
- Rename: `components/canvas/node-color-toolbar.tsx` → `components/canvas/node-properties-toolbar.tsx` (`git mv`)
- Modify: `components/canvas/canvas-editor.tsx:15,42` (import/JSX rename), `app/globals.css` (only if a divider/badge token is needed beyond utilities)
- Test: `tests/unit/components/node-color-toolbar.test.tsx` (extend — **keep the file name**: the spec's AC-034/035, TC-033 and F22 AC-016/TC-009 all reference it; add a header comment "tests `node-properties-toolbar.tsx`")

**Interfaces:**
- Consumes: `useSelectedNodeIds`, `useSelectionValue`, `MIXED`, `Shared` (Task 6); `updateNodesData` fn form (Task 3); `fitHeight`, `measureLabel` (Task 3); `effectiveText`, `effectiveBorder`, `isShapeKind`, `isTextOptionKind` (Task 3); `normaliseColor`, `isHexColor`, `textContrastOk` (Task 5 / F22); `readRecentColors`, `pushRecentColor` (Task 5); `NODE_COLOR_IDS`, `NODE_COLORS`, `TEXT_SIZES`, `TEXT_SIZE_PX` (F22); `Tooltip` from `components/ui/tooltip`; icons listed in Global Constraints.
- Produces:
  ```ts
  // components/canvas/node-hex-input.tsx
  export interface NodeHexInputProps {
    current: Shared<NodeColor> | undefined;   // the selection's shared colour; a hex renders the "current custom colour" swatch
    guardTextContrast: boolean;               // true when a `text`-kind node is selected → refuse hexes failing textContrastOk('text', hex)
    onApply(color: NodeColor): void;          // the toolbar maps it to ONE updateNodesData(ids, { color })
    onClose(): void;                          // Escape → collapse the row; focus returns to "More colours"
  }
  export function NodeHexInput(props: NodeHexInputProps): JSX.Element
  //   <div role="group" aria-label="Custom colour" className="nodrag nopan …"> with <input aria-label="Hex colour" maxLength={7} spellCheck={false} inputMode="text" className="nodrag nopan h-6 w-20 …">
  //   Enter: c = normaliseColor(value); null → aria-invalid="true", no call; guard failure → aria-invalid="true" + aria-errormessage → <span role="tooltip" id=…>Too low contrast</span>, no call; else onApply(c) and, when isHexColor(c), pushRecentColor(c)
  //   swatches (24 × 24, role="button"): current (`aria-label="Current colour: #rrggbb"`, only when isHexColor(current)) then recent (`aria-label="Recent colour: #rrggbb"`, click → onApply + pushRecentColor)
  //   native keydown on the input stops propagation (as the label editor does) so Enter/Escape/Backspace never reach React Flow or F10

  // components/canvas/node-properties-toolbar.tsx
  export function NodePropertiesToolbar(): JSX.Element | null   // null when !canEdit or ids.length === 0 (v1 gate)
  // internal, not exported:
  // OptionGroup<T>({ label, options: { value: T; label: string; icon?: ReactNode; text?: string }[], value: Shared<T> | undefined, onChange(value: T) })
  //   → <div role="radiogroup" aria-label={label}> with role="radio" aria-checked buttons, v1 roving tabindex (nextIndex generalised to `count`), one tab stop per group; a <span role="img" aria-label="Mixed">—</span> when value === MIXED
  ```
  Groups in order, each separated by `<span role="separator" aria-orientation="vertical" className="w-px self-stretch bg-surface-border" />`: 1 "Node colour" (v1 radiogroup + a `More colours` toggle button `aria-expanded`, Palette icon; expanded → `NodeHexInput` row on the next line) · 2 "Border style" (`none` Ban / `solid` Square / `dashed` SquareDashed; tooltips "No border"/"Solid"/"Dashed") · 3 border width button (`aria-label` `Border width: N px` or `Border width: mixed`, text `N` or `—`, click → `mixed ? 1 : (N % 3) + 1`) · 4 "Text size" (`S M L XL` text radios, tooltips Small/Medium/Large/Extra large) · 5 Bold toggle (`aria-pressed`, tooltip "Bold (Ctrl+B)") · 6 "Text alignment" (TextAlignStart/Center/End; "Align left/centre/right") · 7 "Vertical alignment" (AlignVerticalJustifyStart/Center/End; "Align top/middle/bottom"). Visibility: 1 always; 2–3 when `useSelectionValue(ids, (d) => isShapeKind(d.shape)) === true`; 4–7 when `useSelectionValue(ids, (d) => isTextOptionKind(d.shape)) === true`. Every button `size-6` (24 px). Container `flex flex-wrap items-center gap-1 max-w-[360px] md:max-w-none rounded-xl border border-surface-border bg-surface/95 p-1 shadow-lg`.
  Writes (each exactly one `updateNodesData` call):
  - colour: `updateNodesData(ids, { color })`
  - border style `s`: `(node) => ({ data: { border: { ...effectiveBorder(node.data), style: s } } })`; width likewise with `width: next`
  - text size `size` / bold `b`: `(node) => { const text = { ...effectiveText(node.data), size }; return { data: { text }, height: isShapeKind(node.data.shape) ? fitHeight({ kind: node.data.shape, width: node.width!, height: node.height!, label: node.data.label, text, border: node.data.border }, measureLabel) : undefined }; }` (text/sticky get the data patch only — F22 FR-015 re-fits sticky on its next commit; recorded as a known limitation)
  - align / valign: data only.
  Mixed bold: next = `true`; mixed size: the chosen size.

- [ ] **Step 1: Write the failing tests** in `tests/unit/components/node-color-toolbar.test.tsx` (rename the describe to `NodePropertiesToolbar (F08 v2)`, keep the four v1 cases, change the import). Node factory gains `data` overrides and kinds (`sticky`, `text`, `frame` with F22's required fields). Mock `@/lib/canvas/text-measure` to return `{ height: Math.ceil((text.length * 8) / width) * 18 }`.

```ts
it('shows the seven groups in FR-024 order with dividers, 24 px buttons and one tab stop per group (AC-035)', …)
  // one rectangle: getAllByRole('radiogroup').map(name) === ['Node colour','Border style','Text size','Text alignment','Vertical alignment']; buttons 'More colours', 'Border width: 1 px', 'Bold' (aria-pressed 'false'); getAllByRole('separator').length === 6; every button toHaveClass('size-6'); buttons with tabIndex 0: one per radiogroup + the three standalone buttons
it('mixed border shows no checked item, a Mixed badge and "—" on the width button; same size stays checked (AC-035)', …)
  // rect { solid,1 } + rect { dashed,3 }, both size m → within(border group): no [aria-checked="true"], getByLabelText('Mixed'); getByRole('button', { name:'Border width: mixed' }) toHaveTextContent('—'); text size 'M' checked
  // click width button → one onNodesChange call; items: both border.width 1, styles solid / dashed preserved
it('kind rules: rectangle + sticky → no border groups, text groups present; rectangle + frame → colour only; rectangle + text node → no border groups (AC-035, F22 AC-016, EC-012)', …)
it('XL on three shapes of different widths is one call with three fitted heights (AC-036 unit half)', …)
  // widths 180/100/60, same 40-char label → click 'XL' → one call, 3 replace items, each data.text.size 'xl', heights pairwise distinct and ≥ 80
it('Bold toggles aria-pressed and writes the whole text object; two stickies with m → L writes size l once (F22 AC-016)', …)
it('More colours → hex flows: apply, normalise, refuse, text-contrast guard, recent list (AC-034, EC-018, EC-019)', …)
  // click 'More colours' → input 'Hex colour' visible (maxLength 7)
  // type '0f766e{Enter}' → one call with color '#0f766e'; button 'Recent colour: #0f766e' present
  // type '#10233D{Enter}' → call with color 'blue' (palette preferred); no new recent entry
  // '#12345{Enter}' → aria-invalid 'true', no call; '{Escape}' → row gone, 'More colours' focused
  // selection = one text node: '111114{Enter}' → aria-invalid 'true', getByRole('tooltip') 'Too low contrast', no call
  // six distinct hexes applied → 5 recent buttons, oldest absent
  // Storage.prototype.getItem/setItem mocked to throw → apply still calls once; no recent buttons; no console.error
it('a toolbar click while editing commits the draft first, then applies the option (AC-041 half, EC-008 rule)', …)
  // dblclick node body, type 'Draft', click 'Bold' → onNodesChange calls in order: [replace label 'Draft'], [replace text.bold true]
it('Tab moves between groups, arrows within one (AC-035 keyboard)', …)
  // focus 'Colour: neutral', '{Tab}' → focus lands on 'More colours', '{Tab}' → the 'Border style' group's tab stop; '{ArrowRight}' stays inside that group
```

- [ ] **Step 2: Run the tests to verify they fail** — `npx vitest run tests/unit/components/node-color-toolbar.test.tsx 2>&1 | tail -n 20` → FAIL (no `Border style` group, no `More colours`).

- [ ] **Step 3: Implement** `NodeHexInput`, then `git mv components/canvas/node-color-toolbar.tsx components/canvas/node-properties-toolbar.tsx` and implement `NodePropertiesToolbar` + `OptionGroup` per the Interfaces block; update `canvas-editor.tsx`. Grep `NodeColorToolbar` / `node-color-toolbar` across `components/`, `app/`, `tests/` and fix every reference except the test file name.

- [ ] **Step 4: Run the tests to verify they pass** — same command → PASS; then `npx vitest run tests/unit/components 2>&1 | tail -n 8` → PASS.

- [ ] **Step 5: Quality gate and commit 4 (toolbar)**

Run: `npm run check 2>&1 | tail -n 15` → green.

```bash
git add lib/canvas/selection-value.ts hooks/useSelectedNodeIds.ts components/canvas/node-hex-input.tsx components/canvas/node-properties-toolbar.tsx components/canvas/canvas-editor.tsx tests/unit/canvas/selection-value.test.ts tests/unit/components/node-color-toolbar.test.tsx
git status --short   # the rename must show as `R  components/canvas/node-color-toolbar.tsx -> components/canvas/node-properties-toolbar.tsx`; add app/globals.css only if you changed it
git commit -m "feat(canvas): properties toolbar for the selection — colour with hex entry, border, text size, bold, alignment; mixed values shown as —"
```

---

### Task 8: End-to-end — single editor and collaboration (T-013, AC-025, AC-026, AC-029, AC-030, AC-036, AC-037, AC-038, AC-040)

**Files:**
- Modify: `tests/e2e/node-editing.spec.ts`, `tests/e2e/node-editing-collab.spec.ts`
- Modify: `tests/e2e/helpers/canvas.ts` (add `resetChanges`, `storageWrites`, `seedSnapshot`)
- Fixture: `tests/fixtures/canvas/v1-small.json` (existing)

**Interfaces:**
- Consumes: `window.__rfChanges`, `window.__rfStore` (Task 1), `window.__history`, `window.__rf`, `window.__canvasMutations`; `dropShape`, `addShape`, `openCanvas` (helpers); `clearRoomStorage` (`tests/e2e/helpers/liveblocks.ts`); `twoUsers` fixture; F13's `PUT /api/projects/[id]/canvas` with body `{ document }` (route accepts v1 bodies after F22 FR-006).
- Produces (helpers in `tests/e2e/helpers/canvas.ts`):
  ```ts
  export function resetChanges(page: Page): Promise<void>;                       // window.__rfChanges = []
  /** Storage-writing changes for `id`: add/remove/replace, position with a position, dimensions with setAttributes. */
  export function storageWrites(page: Page, id: string): Promise<NodeChange[]>;
  /** PUTs `document` as the project's snapshot via page.request (signed-in page), clears room Storage, so the next openCanvas seeds from it (D-034). */
  export function seedSnapshot(page: Page, projectId: string, document: unknown): Promise<void>;
  ```
  Extend the spec-local `stored(page, id)` to also return `text` and `border`. Locators: `page.getByRole('radiogroup', { name })` for 'Node colour' | 'Border style' | 'Text size' | 'Text alignment' | 'Vertical alignment'; `getByRole('button', { name: /^Border width: / })`, `getByRole('button', { name: 'Bold' })`, `getByRole('button', { name: 'More colours' })`, `getByRole('textbox', { name: 'Hex colour' })`; the styled box is `node(page, id).locator('[data-shape]')` (the `.react-flow__node` wrapper carries no border or fill).

- [ ] **Step 1: Write the single-editor tests** in `tests/e2e/node-editing.spec.ts` (each `test.setTimeout(90_000)`):

```ts
test('Shift keeps the drag-start aspect ratio only while a handle is active; box-select is untouched (AC-025, AC-026)', …)
  // hexagon A 160×110 via dropShape at (500,300). Gesture 1 (Shift from the second move): move to handle.bottom.right, mouse.down, move +10,+2 (steps 2), keyboard.down('Shift'), move to +80,+10 (steps 8), mouse.up, keyboard.up('Shift')
  //   → expect.poll(stored) toMatchObject({ width: 240, height: 165 })   (width-led: 240 / (160/110))
  // Gesture 2 on A (Shift released before the last move): mouse.down, keyboard.down('Shift'), move +20,+20, keyboard.up('Shift'), move to +40,+40, mouse.up → { width: 280, height: 205 } (free)
  // hexagon B 160×110 via dropShape at (900,300). Gesture 3 (Shift before mouse.down, released after mouse.up): keyboard.down('Shift'), drag handle.bottom.right +80,+10, mouse.up, keyboard.up('Shift')
  //   → B { width: 240, height: 165 }; page.locator('.react-flow__selection') toHaveCount(0) during and after; '.react-flow__node.selected' toHaveCount(1) and it is B
  // box-select: keyboard.down('Shift'), drag on the empty pane from (400,150) to (1250,550), keyboard.up('Shift') → '.react-flow__node.selected' toHaveCount(2)
test('shrinking the width grows the height to the label at resize end, in one undo step (AC-030)', …)
  // rectangle; drag line.right +120 → width 300; dblclick, type a 12-word label, Enter; h0 = stored().height
  // drag line.right −200 → expect.poll(stored) width 100 and height > h0; and height ≥ label scrollHeight / zoom + 18 (page.evaluate on [data-slot="node-label"])
  // window.__history.undo() → width 300 AND height h0 together (UNDO_PATH A); if status.md recorded path B: undo twice, asserting height h0 first (width still 100), then width 300
test('XL on three selected nodes is one change set with distinct heights; multi-node drag is one undo step (AC-036, AC-037)', …)
  // three rectangles at x 500/750/1000, y 350; line.right drags −80 and −120 on the second and third → widths 180/100/60; same 40-char label on each (dblclick, type, Enter)
  // box-select all three (plain drag on the empty pane from (450,250) to (1250,500)); resetChanges; click 'XL' → __rfChanges has exactly one entry with three replace items; stored heights pairwise distinct; each [data-slot="node-label"] toHaveCSS('font-size','28px')
  // undo once → all three heights back and no data.text.size 'xl'
  // drag the selection by (120, 60) from the centre of node 1 (steps 10) → all three x moved by > 100; undo once → all three original positions
```

- [ ] **Step 2: Write the collaboration tests** in `tests/e2e/node-editing-collab.spec.ts` (`test.setTimeout(120_000)`):

```ts
test('a long label commit by A is one replace with the fitted height; one undo restores both; B emits no write (AC-029, EC-017)', …)
  // A: rectangle 180×80; resetChanges on A and B; A dblclick, 6 lines via Shift+Enter, Enter
  // A: storageWrites(a, id) → exactly one, type 'replace', item.height > 80, item.data.label has 5 newlines; B: node(b,id) toHaveCSS('height', `${h}px`) within 1 s
  // B: storageWrites(b, id) → []; b.evaluate(() => window.__history!.canUndo()) === false
  // A: undo → label '' and height 80 in one step on both pages
test('a viewer renders borders, text options and hex colours but gets no properties toolbar; its writes are ignored (AC-038)', …)
  // A: click 'Dashed', click the width button twice (→ 3), click 'XL', click 'Bold', More colours + '0f766e' + Enter
  // B (viewer, openCanvas(b, projectId, false)): node(b,id).locator('[data-shape]') toHaveCSS('border-style','dashed'), ('border-width','3px'), ('background-color','rgb(15, 118, 110)'); [data-slot="node-label"] toHaveCSS('font-size','28px'), ('font-weight','600'), ('color','rgb(255, 255, 255)')
  // B: getByRole('radiogroup', { name:'Node colour' }) toHaveCount(0); getByRole('button', { name:'Bold' }) toHaveCount(0); '.react-flow__resize-control' toHaveCount(0)
  // B: __canvasMutations.updateNodesData([id], { border:{ style:'none', width:1 } }) → after 2 s A's stored border still { dashed, 3 }
test('concurrent border and colour writes both land; a v1 document renders as v1 and nobody writes (AC-040, EC-021, EC-023)', …)
  // A clicks 'Dashed' while B (editor) applies hex '0f766e' (Promise.all, same tick) → both pages stored { border.style:'dashed', color:'#0f766e' } within 1 s
  // v1: seedSnapshot(a, projectId, JSON.parse(readFileSync('tests/fixtures/canvas/v1-small.json','utf8'))); openCanvas(a); openCanvas(b)
  //   every node's [data-shape] toHaveCSS('border-width','1px'), ('border-style','solid'); [data-slot="node-label"] font-size 14px, font-weight 400; resetChanges both; waitForTimeout(2_000); storageWrites for every node id → [] on both
```

- [ ] **Step 3: Run the two specs against the local stack**

Run (Git Bash; `$SCRATCH` = any directory outside the repo): `E2E_PORT=3108 npx playwright test tests/e2e/node-editing.spec.ts tests/e2e/node-editing-collab.spec.ts 2>&1 | tee "$SCRATCH/f08v2-e2e.log" | tail -n 25` (PowerShell: `$env:E2E_PORT='3108'; npx playwright test …`). With the Liveblocks dev server: add `E2E_LIVEBLOCKS=1` and run `npx liveblocks dev --no-persist` in another shell.
Expected: `11 passed` (node-editing: 3 v1 + 3 new; collab: 2 v1 + 3 new), `0 failed`, `0 flaky`; without `E2E_USER_B_*` the two viewer tests report `skipped` (`9 passed, 2 skipped`). On any failure, diagnose (do not loosen assertions). If the resizer's first 10 px move is swallowed in Gesture 1, add one 4 px warm-up move before pressing Shift and keep the final deltas — the final size depends only on the total delta and the drag-start size.

- [ ] **Step 4: Manual AC-039 screenshots**

On the dev server at zoom 0.5, 1 and 2 and viewport widths 1280 and 700 px: dashed 1 px border legibility, toolbar single row at ≥ 768 px and two rows below, mixed badge, no toolbar/node overlap. Save PNGs under `features/08-node-editing/evidence/` (create the folder) and reference them from `status.md`.

(Commit 5 after Task 9.)

---

### Task 9: Final verification, docs (T-014) and commit 5

**Files:**
- Modify: `features/08-node-editing/status.md` (v2 evidence table, AC mapping, T-008 paths, limitations), `context/ui-context.md` "Canvas visuals" (text sizes 12/14/20/28, border styles/widths, hex rule and derived text colour), `context/decision-log.md` (D-08e, D-08f, D-08g as APPROVED under D-066 with their adopted values; append after D-066)
- Do **not** modify: `context/progress-tracker.md` (main session updates it in the round report), `No_touch_ai/`, `AGENTS.md` generated blocks, `features/08-node-editing/0*.md`.

- [ ] **Step 1: Full quality gate with evidence**

Run: `npm run check 2>&1 | tee "$SCRATCH/f08v2-check.log" | tail -n 20` → `tsc` clean, ESLint clean, Vitest `Test Files N passed`, `prisma validate` OK. Then `npm run build 2>&1 | tail -n 15` → `✓ Compiled` with no Cache Components errors. Then re-run the E2E command of Task 8 Step 3 and keep its log.

- [ ] **Step 2: Acceptance walk-through** — fill the `status.md` AC table: AC-025/026 (TC-036), AC-027 (dropped, owner decision 5), AC-028 (fit-height unit), AC-029 (TC-040), AC-030 (TC-038 + resizer unit), AC-031 (label-editor unit), AC-032 (shape-renderer unit), AC-033 (color unit), AC-034/035 (toolbar unit), AC-036/037 (TC-039), AC-038 (TC-041), AC-039 (screenshots), AC-040 (TC-042), AC-041 (label-editor + toolbar unit). State any unmet criterion explicitly. Record limitations: toolbar size/bold on `text`/`sticky` does not re-fit height (F22 FR-015 does on the next commit); `dotted` has no UI; mirror ownership note from Task 3; test file kept as `node-color-toolbar.test.tsx`.

- [ ] **Step 3: Docs** — update `context/ui-context.md` and `context/decision-log.md` as listed (owner authorised T-014 under D-066; keep the edits to the named sections).

- [ ] **Step 4: Review the diff for scope** — `git diff --stat main...HEAD` must list only the files named in this plan (plus F22 call sites adapted in Tasks 4–5). No `.env*`, no unrelated working-tree changes (`git status` — leave the owner's pre-existing `.gitignore`/`AGENTS.md`/`.claude/` changes unstaged).

- [ ] **Step 5: Commit 5 (e2e + docs)**

```bash
git add tests/e2e/node-editing.spec.ts tests/e2e/node-editing-collab.spec.ts tests/e2e/helpers/canvas.ts features/08-node-editing/status.md features/08-node-editing/evidence context/ui-context.md context/decision-log.md
git commit -m "test(canvas): F08 v2 e2e — Shift aspect, auto-grow undo, batched toolbar writes, viewer and v1 fixture; record D-08e/f/g and v2 evidence"
git log --format='%h %an <%ae> %s' -5    # five commits, all krishna <krishnagtkr@gmail.com>, no trailers
```

Do not push. Report per CLAUDE.md §9 (Phase, Changed, Verification with the three logs, Acceptance, Git, Blockers, Next step) and stop.
