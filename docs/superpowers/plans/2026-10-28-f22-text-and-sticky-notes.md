# F22 Text and Sticky Notes (+ Canvas Schema v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship canvas schema v2 (one migration reserving every batch-1–3 field) plus two whiteboard kinds — a borderless auto-width `text` node and a filled, resizable `sticky` note — created by palette or `T`/`N`, edited with the F08 label editor, synced at the author's committed size.

**Architecture:** Pure-TypeScript schema layer first (`types/canvas.ts` → `lib/canvas/schema.ts`, `color.ts`, `text-measure.ts`), then the single React Flow node type `canvasNode` dispatching on `data.shape` to `ShapeNode` / `TextNode` / `StickyNode` / `ReservedKindNode`. All writes go through `useCanvasMutations` (`addNodeOfKind`, `commitTextNode`); measurement happens only on the editing client via an injectable `Measurer` (React context, DOM mirror by default) so unit tests stub it. No new toolbar: F08 v2 owns the properties toolbar and consumes the exports listed in Task 1.

**Tech Stack:** Next.js 16 (Cache Components), React 19, `@xyflow/react` 12.12, `@liveblocks/react-flow` 3.24.4, Zod 4.6, Tailwind 4 tokens + shadcn, Vitest + Testing Library, Playwright.

**Spec:** `features/22-text-and-sticky-notes/00-overview.md` … `05-test-plan.md`, `status.md`; `context/domain-model.md` "Canvas schema v2"; `docs/research/batch1-owner-decisions.md` items 7–10 (adopted as recommended, D-066).

## Global Constraints

- TypeScript `strict`; no `any`; exhaustive `switch` with a `never` default on every kind dispatch (NFR-007); `import type` for types.
- Dependency direction `components → hooks → lib → types`; no React in `lib/`; no business logic in components; no new runtime dependency (`fractional-indexing` stays with F23).
- Styling: shadcn/Tailwind token utilities only (`bg-surface`, `border-surface-border`, `text-copy-faint`, `ring-brand`, …); no inline hex outside `types/canvas.ts` and `app/globals.css` — the pure pair `#FFFFFF`/`#000000` and `--bg-base` `#080809` therefore live in `types/canvas.ts`.
- `console.*` is lint-banned; the one-per-id diagnostics use `// eslint-disable-next-line no-console` exactly as `canvas-node.tsx:23` does today.
- One React Flow node type: `nodeTypes = { canvasNode }` and `type: 'canvasNode'` never change; `CanvasNode` dispatches on `data.shape` (D-22a).
- Every v2 field is optional with a per-kind default; `migrateV1ToV2` is a pure version stamp (D-22d). `NODE_SHAPES` (six) is unchanged.
- Sizes: `DEFAULT_SIZES.text` 24 × 20, `DEFAULT_SIZES.sticky` 250 × 250; `MIN_SIZES` shapes/line/freehand/frame/image 48 × 32, text 24 × 20, sticky 75 × 75. Font sizes `s/m/l/xl` = 12/14/20/28 px, default `m`; sticky default colour palette `orange`; text default `neutral`; text/sticky align `left`/`top`, shapes `center`/`middle` (D-22e). `TEXT_MAX_LENGTH = 500` (= `MAX_LABEL`); `LABEL_MAX_LENGTH` 200 stays for the six shapes.
- Text nodes: no fill, no border, no handles, no shadow, `white-space: pre` while `autoWidth`; left/right resize controls only, `minWidth 24`. Sticky: four handles, F08 resizer with `minWidth = minHeight = 75`, `rounded-[4px]`, shadow `0 2px 8px rgba(0,0,0,.45)` (in `globals.css`), padding 12 px (D-22c).
- Editing keeps F08 semantics: Enter commits, Shift+Enter newline, Esc cancels (D-053), blur commits, unmount never commits; exactly **one** Storage write per commit / per resize end (one undo entry, D-013).
- Empty committed text node (after `trim`) → deleted via `onDelete`; Esc on a never-labelled text node → deleted; stickies are never auto-deleted (FR-013).
- Hex colours `#rrggbb` only; derived text colour via the shared `lib/canvas/color.ts` is pure white/black by WCAG luminance (≥ 4.58:1); `textContrastOk` guards only the `text` kind against `--bg-base`.
- Edges connect only `HANDLE_KINDS = [...NODE_SHAPES, 'sticky', 'image']`; Zod rejects others with path `['edges', i, end]`.
- Properties toolbar is F08 v2's (`node-properties-toolbar.tsx` — **absent on `main` today**): F22 builds no toolbar; it exports `TEXT_OPTION_KINDS`, `DEFAULT_TEXT`, `DEFAULT_BORDER`, `TEXT_SIZE_PX`, `effectiveText`, `textStyle`. AC-016 stays blocked until F08 v2 T-012 merges.
- Shortcuts: `lib/canvas/registry.ts` is **absent on `main` today** → F22 uses the interim `matchShortcut` path (`'addText' | 'addSticky'`), per the FR-008 ordering rule. Task 5 step 1 re-checks this at execution time.
- Viewers: palette already hidden, `T`/`N` are `MUTATING` no-ops, no resizer/editor/placeholder; `useCanvasMutations` guards stay the second line of defence.
- Next.js 16 Cache Components rules (`context/code-standards.md` §Next.js 16): everything here is `'use client'` canvas code or pure `lib/`; no segment config exports, no request data in cached functions.
- Git: branch `feat/f22-text-and-sticky-notes` off `main` in its own worktree; author **and** committer `krishna <krishnagtkr@gmail.com>`; **no** `Co-Authored-By` or other AI attribution; **five commit points** (C1–C5 below), each only after `npm run check` is green; stage only listed files; never push.
- Tests: lean budget (`context/testing-strategy.md` "Test budget") — behaviour/risk tests only; schema is the data-integrity boundary and gets the most cases. E2E runs with `E2E_PORT=<free port>`; each agent uses its own worktree and its own `DATABASE_URL_TEST` schema.

## Review Focus

1. Re-committing an unchanged label on a text node (open editor, press Enter) must write nothing when the measured size equals the stored size — otherwise every glance creates a Storage write and an undo entry. → Task 7 test `writes nothing when label and measured size are unchanged`.
2. A label that is only whitespace or newlines (`"  \n "`) is "empty" after `trim` and must delete the text node, not store an invisible node. → Task 7 test `deletes the node when the committed label is whitespace only`.
3. `Ctrl+D` on a text node or sticky must copy the kind-specific fields (`autoWidth`, `text`, hex `color`) and keep the `text_`/`sticky_` id prefix, or Zod rejects the duplicate at the next save. → Task 3 test `duplicates text and sticky nodes with their kind fields and id prefix`.
4. A six-shape node carrying a hex `color` written by F08 v2 (e.g. `rectangle` + `#FDE68A`) must render that fill with derived black text instead of falling back to neutral — `ShapeRenderer` today indexes `NODE_COLORS` directly. → Task 4 test `renders a hex colour on a shape through resolveColor`.
5. `Enter` on a focused (selected) sticky or text node must open the editor like it does on shapes (F08 FR-006 parity); the spec only names double-click for the new kinds. → Task 8 test `Enter on the focused sticky wrapper opens the editor`.

---

## File structure

| Path | Action | Responsibility |
|---|---|---|
| `types/canvas.ts` | modify | v2 constants and types: `NODE_KINDS`, `HANDLE_KINDS`, `TEXT_OPTION_KINDS`, `PaletteKind`, `isNodeShape`, `NodeColor`/`HexColor`, hex constants, `TextOptions`/`BorderOptions`/`EdgeStyle` + defaults, discriminated `CanvasNodeData`, `NodeDataPatch`, `DEFAULT_SIZES`/`MIN_SIZES`, `PersistedNode` (+`parentId`/`extent`), `CanvasDocument` v2 |
| `lib/canvas/ids.ts` | modify | `newNodeId(kind: NodeKind)` |
| `lib/canvas/color.ts` | create | `isHexColor`, `contrastRatio`, `resolveColor`, `textContrastOk` (pure; shared with F08 v2) |
| `lib/canvas/schema.ts` | modify | Zod v2: `ColorSchema`, option schemas, discriminated node data union, per-kind min sizes, id-prefix rule, edge style, `parentId`/frame rules, endpoint rule, `migrateV1ToV2`, `MIGRATIONS[1]` |
| `lib/canvas/serialize.ts` | modify | `toDocument` emits v2, whole `data`, `parentId`/`extent`; `fromDocument` passes them back |
| `lib/canvas/templates.ts` | modify | type widening only (`NodeSpec` keeps `NodeShape`); `buildDocument` already stamps `CANVAS_SCHEMA_VERSION` |
| `lib/canvas/text-style.ts` | create | `effectiveText(kind, data)`, `textStyle(options)` — the typography contract F08 v2 reads |
| `lib/canvas/text-measure.ts` | create | `measureText(input)`, `fontsReady()`, `TEXT_PADDING`, `STICKY_PADDING`; body-level hidden mirror (no React) |
| `lib/canvas/pending-editor.ts` | create | `requestEditorOpen(id)` / `takeEditorOpen(id)` — "open the editor on mount" flag set by the mutation |
| `lib/canvas/focus-node.ts` | create | `focusNodeWhenRendered(container, id)` moved out of `shape-palette.tsx` for reuse by `T`/`N` |
| `lib/canvas/shortcuts.ts` | modify | `'addText' \| 'addSticky'`, `t`/`n` matching, `MUTATING`, `formatKeys`, two cheat-sheet rows |
| `hooks/useCanvasMutations.ts` | modify | `addNodeOfKind`, `commitTextNode`, `NodeDataPatch` signatures |
| `hooks/useCanvasActions.ts` | modify | `addText()`, `addSticky()` at the viewport centre |
| `hooks/useKeyboardShortcuts.ts` | modify | `run()` cases for the two actions |
| `hooks/useShapeDrag.ts` | modify | `NodeShape` → `PaletteKind` in state/options/button props |
| `hooks/useSelectedNodeIds.ts` | modify | `useSelectionColor` returns `null` when any selected colour is a hex (v1 toolbar shows no active swatch) |
| `components/canvas/shape-palette.tsx` | modify | `PALETTE_ITEMS`, two items, divider, `addNodeOfKind` for text/sticky |
| `components/canvas/shape-drag-ghost.tsx` | modify | text ("Text" word) and sticky (filled square) previews |
| `components/canvas/nodes/canvas-node.tsx` | modify | dispatcher only: `kindOf` + `switch` (memo wrapper unchanged) |
| `components/canvas/nodes/shape-node.tsx` | create | today's `CanvasNodeImpl` body for the six shapes, `shape` prop, label typography from `effectiveText` |
| `components/canvas/nodes/shape-renderer.tsx` | modify | `color: NodeColor` resolved through `resolveColor` |
| `components/canvas/nodes/text-node.tsx` | create | auto-width/fixed-width text, side-only resizer, empty/Esc delete, placeholder "Text" |
| `components/canvas/nodes/sticky-node.tsx` | create | filled note, F08 resizer (75 min), four handles, auto-grow on commit |
| `components/canvas/nodes/reserved-kind-node.tsx` | create | placeholder for `line`/`freehand`/`frame`/`image` |
| `components/canvas/nodes/text-measure-context.ts` | create | `Measurer` type, `TextMeasureContext`, `useTextMeasure()` (default = `fontsReady` + `measureText`) |
| `components/canvas/nodes/warn-once.ts` | create | `warnOnce(id, message)` shared by dispatcher, reserved node and colour fallback |
| `components/canvas/nodes/node-resizer.tsx` | modify | `kind`, `sides: 'all' \| 'horizontal'`, `onResizeEnd`; min sizes from `MIN_SIZES[kind]` |
| `components/canvas/nodes/node-label-editor.tsx` | modify | additive props: `maxLength`, `className`, `style`, `wrapperClassName`, `placeholder`, `onDraftChange` |
| `components/canvas/nodes/node-label.tsx` | modify | additive `style` prop |
| `app/globals.css` | modify | `.canvas-text-node` hover/selected outlines, `.canvas-sticky-node` shadow |
| `scripts/gen-large-fixture.mjs` | modify | stamps `schemaVersion: 2`; fixture regenerated |
| `tests/factories.ts` | modify | `makeCanvasDocument` stamps 2 |
| `tests/fixtures/canvas/v2-small.json`, `v2-kinds.json` | create | migration expectation; v2 freeze fixture |
| `tests/fixtures/canvas/templates/*.json`, `large-500-nodes.json` | regenerate | version digit only |
| `tests/unit/canvas/{schema,color,text-measure,serialize,templates,shortcuts,duplicate}.test.ts`, `tests/unit/hooks/useCanvasMutations.test.tsx`, `tests/unit/fixtures/large-fixture.test.ts`, `tests/integration/api/canvas-route.test.ts` | create/modify | L1/L2 per task |
| `tests/unit/components/canvas/{text-node,sticky-node,reserved-kind-node,shape-palette}.test.tsx` | create | L1 component cases |
| `tests/e2e/helpers/canvas.ts`, `tests/e2e/text-sticky.spec.ts`, `tests/e2e/text-sticky-collab.spec.ts` | modify/create | L3 |

Commit points: **C1** Tasks 1–3 (schema v2) · **C2** Tasks 4–5 (dispatch + creation) · **C3** Tasks 6–7 (text node) · **C4** Task 8 (sticky + editor contract) · **C5** Tasks 9–10 (e2e + verification).

---

### Task 0: Worktree and branch

**Files:** none (git only)

- [ ] **Step 1: Create the worktree off `main`**

Run: `git worktree add ../ghost_ai-f22 -b feat/f22-text-and-sticky-notes main` then `cd ../ghost_ai-f22 && npm ci`
Expected: branch `feat/f22-text-and-sticky-notes` at `52d587e` or later; `node_modules` present.

- [ ] **Step 2: Verify the committing identity**

Run: `git log -3 --format='%an <%ae>'` and `git config user.name; git config user.email`
Expected: recent authors are `krishna <krishnagtkr@gmail.com>`. Every commit below is made with `git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit …` so author and committer match even if the local config differs. If the log shows a different owner identity, stop and ask.

- [ ] **Step 3: Confirm the FR-008 / FR-016 ordering facts**

Run: `ls lib/canvas/registry.ts components/canvas/node-properties-toolbar.tsx`
Expected: both "No such file" → interim `matchShortcut` path (Task 5) and AC-016 blocked (Task 8 note). If `registry.ts` exists, Task 5 registers `addText`/`addSticky` there instead of touching `matchShortcut` and skips its `matchShortcut` tests.

---

### Task 1: v2 constants, types, ids and the colour module

**Files:**
- Modify: `types/canvas.ts` (whole file; v1 header comment → v2)
- Modify: `lib/canvas/ids.ts:18-21`
- Create: `lib/canvas/color.ts`
- Test: `tests/unit/canvas/color.test.ts`

**Interfaces:**
- Consumes: `NODE_COLORS`, `NODE_COLOR_IDS` (existing).
- Produces (all from `types/canvas.ts` unless noted):
  - `CANVAS_SCHEMA_VERSION = 2 as const`
  - `NODE_KINDS`, `type NodeKind`; `HANDLE_KINDS`; `TEXT_OPTION_KINDS`; `type PaletteKind = NodeShape | 'text' | 'sticky'`
  - `isNodeShape(kind: string): kind is NodeShape`; `isNodeKind(kind: string): kind is NodeKind`
  - `type HexColor = \`#${string}\``; `type NodeColor = NodeColorId | HexColor`; `HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/`; `PURE_TEXT = { light: '#FFFFFF', dark: '#000000' } as const`; `BG_BASE_HEX = '#080809'`
  - `TEXT_SIZES`, `type TextSize`, `TEXT_SIZE_PX = { s: 12, m: 14, l: 20, xl: 28 } as const`, `type TextOptions`, `type BorderOptions`, `DEFAULT_TEXT: Record<NodeKind, TextOptions>`, `DEFAULT_BORDER: Record<NodeKind, BorderOptions>`, `TEXT_MAX_LENGTH = 500`
  - `type MarkerKind`, `type StrokeStyle`, `type EdgeStyle`, `DEFAULT_EDGE_STYLE`, `type CanvasEdgeData = { label?: string; style?: EdgeStyle }`
  - `type ShapeData | TextData | StickyData | LineData | FreehandData | FrameData | ImageData`, `type CanvasNodeData` (union, exactly as 02-design "Domain model"), `type NodeDataPatch = Partial<Pick<ShapeData, 'label' | 'color' | 'text' | 'border' | 'locked' | 'groupId' | 'order' | 'href'>>`
  - `DEFAULT_SIZES: Record<NodeKind, { width; height }>` (+ text 24×20, sticky 250×250, line 100×100, freehand 100×100, frame 400×300, image 200×150); `MIN_SIZES: Record<NodeKind, …>` (replaces `MIN_SIZE`)
  - `interface PersistedNode { …; parentId?: string; extent?: 'parent' }`; `CanvasDocument.schemaVersion: 2`
  - `lib/canvas/ids.ts`: `newNodeId(kind: NodeKind): string`
  - `lib/canvas/color.ts`: `isHexColor(value: string): value is HexColor`; `contrastRatio(a: string, b: string): number`; `resolveColor(color: string): { fill: string; text: string; custom: boolean }`; `textContrastOk(kind: NodeKind, color: string): boolean`

- [ ] **Step 1: Write the failing colour tests** in `tests/unit/canvas/color.test.ts` (`// @vitest-environment node`)

```ts
describe('resolveColor / textContrastOk (F22 AC-004)', () => {
  it.each(NODE_COLOR_IDS)('palette id %s returns the NODE_COLORS pair and passes textContrastOk for every kind', (id) => {
    expect(resolveColor(id)).toEqual({ ...NODE_COLORS[id], custom: false });
    for (const kind of NODE_KINDS) expect(textContrastOk(kind, id), kind).toBe(true);
  });
  it('derives pure black or white for a hex fill, always ≥ 4.58:1', () => {
    expect(resolveColor('#FDE68A')).toEqual({ fill: '#FDE68A', text: '#000000', custom: true });
    expect(resolveColor('#1E3A8A')).toEqual({ fill: '#1E3A8A', text: '#FFFFFF', custom: true });
    const worst = resolveColor('#757575');
    expect(contrastRatio(worst.fill, worst.text)).toBeGreaterThanOrEqual(4.58);
    expect(textContrastOk('sticky', '#757575')).toBe(true);
    expect(resolveColor('#fde68a').fill).toBe('#fde68a'); // case preserved; schema accepts either
  });
  it('flags a hex that fails against --bg-base for the text kind only, but still resolves it', () => {
    expect(textContrastOk('text', '#111114')).toBe(false);
    expect(textContrastOk('rectangle', '#111114')).toBe(true);
    expect(resolveColor('#111114').fill).toBe('#111114');
  });
  it('falls back to neutral with one warning for a malformed value (EC-015)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveColor('#FFF')).toEqual({ ...NODE_COLORS.neutral, custom: false });
    expect(resolveColor('#FFF')).toEqual({ ...NODE_COLORS.neutral, custom: false });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(resolveColor('rgb(0,0,0)').fill).toBe(NODE_COLORS.neutral.fill);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/canvas/color.test.ts`
Expected: FAIL — `Cannot find module '@/lib/canvas/color'`.

- [ ] **Step 3: Rewrite `types/canvas.ts` per the Interfaces block**

Keep the six-shape `NODE_SHAPES`, `NODE_COLOR_IDS`, `NODE_COLORS`, `HANDLE_IDS`, `EDGE_STROKE`, `EDGE_LABEL_MAX_LENGTH`, `LABEL_MAX_LENGTH` unchanged. Write the union members as flat `type` aliases that spread `CommonData` (not `interface`), so they satisfy React Flow's `Record<string, unknown>` data constraint. Header comment: schema v2 frozen at F22 approval (D-057, D-066); the change rule is unchanged (bump + `migrateV{n}ToV{n+1}` + fixture + decision).

- [ ] **Step 4: Implement `lib/canvas/color.ts`**

WCAG relative luminance exactly as `tests/unit/canvas/palette.test.ts:14-25` computes it. `resolveColor`: palette id → pair, `custom: false`; valid hex → `{ fill: hex, text: contrast(hex, '#000000') >= contrast(hex, '#FFFFFF') ? PURE_TEXT.dark : PURE_TEXT.light, custom: true }`; anything else → neutral pair, `custom: false`, `console.warn` once per distinct value (module-level `Set`). `textContrastOk`: `kind !== 'text'` → `true`; `text` kind → `contrastRatio(textColourOf(color), BG_BASE_HEX) >= 4.5` where the text colour of a palette id is `NODE_COLORS[id].text` and of a hex is the hex itself.

- [ ] **Step 5: Change `newNodeId(kind: NodeKind)` in `lib/canvas/ids.ts`**

- [ ] **Step 6: Run the colour tests**

Run: `npx vitest run tests/unit/canvas/color.test.ts`
Expected: PASS (4 tests). `tsc` is expected to fail until Task 3 — do not commit yet.

---

### Task 2: Zod schema v2, migration and fixtures

**Files:**
- Modify: `lib/canvas/schema.ts` (whole file)
- Create: `tests/fixtures/canvas/v2-small.json`, `tests/fixtures/canvas/v2-kinds.json`
- Modify: `tests/unit/canvas/schema.test.ts`

**Interfaces:**
- Consumes: Task 1 types and constants.
- Produces: `NodeIdSchema` (regex over `NODE_KINDS`), `ColorSchema`, `TextOptionsSchema`, `BorderSchema`, `EdgeStyleSchema`, `NodeDataSchema` (discriminated union on `shape`), `PersistedNodeSchema`, `PersistedEdgeSchema`, `CanvasDocumentSchema`, `migrateV1ToV2(doc: Record<string, unknown>): Record<string, unknown>`, `migrate`, `validateDocument` (unchanged signatures), `MAX_NODES`/`MAX_EDGES`/`MAX_LABEL` unchanged.

- [ ] **Step 1: Write the fixtures**

`v2-small.json` = `v1-small.json` with `"schemaVersion": 2` and nothing else changed.

`v2-kinds.json` (`schemaVersion: 2`), ids `${kind}_01JBE0000000000000000000K1`…`K12`, positions on a 300 px grid, sizes = `DEFAULT_SIZES[kind]`:
- six shapes (`rectangle` … `hexagon`), the `rectangle` carrying `color: '#FDE68A'`, `text: { size: 'l', align: 'left', valign: 'top', bold: true }`, `border: { style: 'dashed', width: 2 }`, `locked: true`, `groupId: 'g_01JBE0000000000000000000G1'`, `order: 'a0'`, `href: 'https://example.com/spec'`; the `circle` carrying `parentId: <frame id>`, `extent: 'parent'`;
- `text` `{ label: 'note', color: 'neutral', autoWidth: true }` 24 × 20; `sticky` `{ label: 'idea', color: 'orange' }` 250 × 250;
- `line` `{ points: [[0, 0], [100, 100]], stroke: { dash: 'dashed', width: 2, markerStart: 'none', markerEnd: 'arrow' } }`; `freehand` `{ points: [[0, 0, 0.5], [10, 10, 0.5]], strokeWidth: 4 }`; `frame` `{ clip: true }` 400 × 300; `image` `{ image: { fileId: 'file_01', status: 'saved', natural: { width: 800, height: 600 } } }` 200 × 150;
- one edge `sticky → rectangle` (`right` → `left`) with `data.style: { path: 'step', dash: 'dotted', width: 3, markerStart: 'circle', markerEnd: 'none' }`.

- [ ] **Step 2: Write the failing schema tests** — edit `tests/unit/canvas/schema.test.ts`:

Replace the type-identity test (an intersection-built union is not `toEqualTypeOf`-identical to Zod's flat objects) with mutual assignability:
```ts
expectTypeOf<CanvasDocumentParsed>().toMatchTypeOf<CanvasDocument>();
expectTypeOf<CanvasDocument>().toMatchTypeOf<CanvasDocumentParsed>();
```
In `MUTATIONS`: `'unknown colour'` value `'#ff0000'` → `'rgb(0,0,0)'`; `'schemaVersion 2'` → `['schemaVersion 3', (d) => ({ ...d, schemaVersion: 3 }), ['schemaVersion']]`; `'node id with a foreign shape prefix'` keeps `star_`. Add `v2Small` and `v2Kinds` fixture loads and these blocks:
```ts
describe('migrateV1ToV2 (AC-001)', () => {
  it('stamps 2 and changes nothing else; validateDocument(migrate(v1)) equals v2-small.json', () => {
    const migrated = migrate(structuredClone(v1Small));
    expect(migrated).toEqual(v2Small);
    const result = validateDocument(migrated);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc).toEqual(v2Small);
    expect(typeof schemaModule.migrateV1ToV2).toBe('function');
    expect(CANVAS_SCHEMA_VERSION).toBe(2);
  });
  it('does not throw on a malformed v1 object and validation then names the missing field', () => {
    const result = validateDocument(migrate({ schemaVersion: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.issues.map((i) => i.path)).toContainEqual(['nodes']);
  });
});
describe('schema v2 kinds and reserved fields (AC-002, AC-003, AC-005)', () => {
  it('accepts v2-kinds.json unchanged', () => { /* ok true, doc toEqual v2Kinds */ });
  it.each<[string, (d: CanvasDocument) => unknown, (string | number)[]]>([
    ['rectangle with points', (d) => (((d.nodes[0].data as Record<string, unknown>).points = [[0, 0], [1, 1]]), d), ['nodes', 0, 'data']],
    ['text without autoWidth', (d) => (delete (d.nodes[6].data as Record<string, unknown>).autoWidth, d), ['nodes', 6, 'data', 'autoWidth']],
    ['image without image', (d) => (delete (d.nodes[11].data as Record<string, unknown>).image, d), ['nodes', 11, 'data', 'image']],
    ['colour #FFF', (d) => ((d.nodes[1].data.color = '#FFF'), d), ['nodes', 1, 'data', 'color']],
    ['colour rgb(0,0,0)', (d) => ((d.nodes[1].data.color = 'rgb(0,0,0)' as never), d), ['nodes', 1, 'data', 'color']],
    ['text_ id on a sticky', (d) => ((d.nodes[7].id = `text_${testUlid(77)}`), d), ['nodes', 7, 'id']],
    ['frame with a parentId', (d) => ((d.nodes[10].parentId = d.nodes[10].id), d), ['nodes', 10, 'parentId']],
    ['parentId pointing at a rectangle', (d) => ((d.nodes[2].parentId = d.nodes[0].id), d), ['nodes', 2, 'parentId']],
    ['order of 65 chars', (d) => ((d.nodes[0].data.order = 'a'.repeat(65)), d), ['nodes', 0, 'data', 'order']],
    ['javascript: href', (d) => ((d.nodes[0].data.href = 'javascript:alert(1)'), d), ['nodes', 0, 'data', 'href']],
    ['sticky 74 wide', (d) => ((d.nodes[7].width = 74), d), ['nodes', 7, 'width']],
    ['text 23 wide', (d) => ((d.nodes[6].width = 23), d), ['nodes', 6, 'width']],
    ['rectangle 47 wide', (d) => ((d.nodes[0].width = 47), d), ['nodes', 0, 'width']],
    ['edge style width 4', (d) => ((d.edges[0].data!.style!.width = 4 as never), d), ['edges', 0, 'data', 'style', 'width']],
    ['edge style path curvy', (d) => ((d.edges[0].data!.style!.path = 'curvy' as never), d), ['edges', 0, 'data', 'style', 'path']],
    ['edge from a text node', (d) => ((d.edges[0].source = d.nodes[6].id), d), ['edges', 0, 'source']],
    ['edge from a frame', (d) => ((d.edges[0].source = d.nodes[10].id), d), ['edges', 0, 'source']],
    ['edge from a line', (d) => ((d.edges[0].source = d.nodes[8].id), d), ['edges', 0, 'source']],
    ['edge to a freehand', (d) => ((d.edges[0].target = d.nodes[9].id), d), ['edges', 0, 'target']],
  ])('rejects %s at the offending path', (_n, mutate, path) => { /* same lookup as the v1 table */ });
  it('accepts the minimum sizes 75×75, 24×20, 48×32 and the valid styled edge', () => { /* set widths to 75/24/48 → ok true */ });
});
```
Node index map for the table: 0–5 shapes in `NODE_SHAPES` order, 6 text, 7 sticky, 8 line, 9 freehand, 10 frame, 11 image.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/unit/canvas/schema.test.ts`
Expected: FAIL on `migrateV1ToV2`, the v2-kinds acceptance and the new mutations.

- [ ] **Step 4: Rewrite `lib/canvas/schema.ts`**

Build in this order: `ULID`; `NodeIdSchema` over `NODE_KINDS`; `GroupIdSchema = /^g_${ULID}$/`; `OrderSchema = /^[0-9A-Za-z]{1,64}$/`; `HrefSchema = z.string().max(2048).regex(/^https?:\/\//)`; `ColorSchema = z.union([z.enum(NODE_COLOR_IDS), z.string().regex(HEX_COLOR_RE)])`; strict `TextOptionsSchema`, `BorderSchema` (`width` = union of literals 1|2|3), `StrokeStyleSchema` (width 1–4), `EdgeStyleSchema`; a `common` field object (`label` ≤ `MAX_LABEL`, `color`, optional `text`/`border`/`locked`/`groupId`/`order`/`href`); seven strict kind objects (`line.points` tuple array 2–100; `freehand.points` 3-tuples ≤ 2000, `strokeWidth` 2–16; `frame.clip`; `image.image` strict with `status` enum and positive `natural`); `NodeDataSchema = z.discriminatedUnion('shape', [...])` where the shape member uses `shape: z.enum(NODE_SHAPES)` (Zod 4 accepts enum discriminators; if construction throws, spread six literal members instead). `PersistedNodeSchema` = strict object + `.superRefine` adding `['width']`/`['height']` issues below `MIN_SIZES[data.shape]` and an `['id']` issue when `id.split('_')[0] !== data.shape`. Edge `data` = strict `{ label?, style?: EdgeStyleSchema }`. Document `superRefine` keeps today's rules and adds: endpoint kind ∉ `HANDLE_KINDS` → `['edges', i, end]`; `parentId` referencing a non-frame or missing node → `['nodes', i, 'parentId']`; a `frame` with `parentId` → same path. `migrateV1ToV2 = (doc) => ({ ...structuredClone(doc), schemaVersion: 2 })`; `MIGRATIONS = { 1: migrateV1ToV2 }`.

- [ ] **Step 5: Run the schema tests**

Run: `npx vitest run tests/unit/canvas/schema.test.ts`
Expected: PASS (all tables; the freeze guard now finds `migrateV1ToV2` and a `v1-*.json` fixture).

---

### Task 3: Serialiser, templates, factories, fixtures and route test on v2 (commit C1)

**Files:**
- Modify: `lib/canvas/serialize.ts:12-24, 49-67`
- Modify: `lib/canvas/templates.ts:36` (type only), `tests/factories.ts:55`, `scripts/gen-large-fixture.mjs:54`
- Modify: `components/canvas/nodes/canvas-node.tsx:18-27`, `components/canvas/nodes/shape-renderer.tsx:5-9, 53`, `components/canvas/nodes/node-resizer.tsx:6, 23-24` (compile fixes only; the full dispatch is Task 4)
- Modify: `tests/unit/canvas/serialize.test.ts`, `tests/unit/canvas/templates.test.ts`, `tests/unit/canvas/duplicate.test.ts`, `tests/unit/fixtures/large-fixture.test.ts:9`, `tests/integration/api/canvas-route.test.ts:34, 99-102, 128`
- Regenerate: `tests/fixtures/canvas/templates/*.json`, `tests/fixtures/canvas/large-500-nodes.json`

**Interfaces:**
- Consumes: Task 1 (`DEFAULT_SIZES: Record<NodeKind,…>`, `isNodeShape`, `resolveColor`, `MIN_SIZES`), Task 2 (`migrate`).
- Produces: `toDocument`/`fromDocument` unchanged signatures, now emitting `schemaVersion: 2`, the whole `data` object, and `parentId`/`extent` when present.

- [ ] **Step 1: Write the failing tests**

`serialize.test.ts`: replace the `v1Small` round-trip row with `['v2-kinds', v2Kinds]` and `['v2-small', v2Small]`; add to the `toDocument` test a `text` node `{ data: { label: 't', shape: 'text', color: 'neutral', autoWidth: false } }` with `width: 30, height: 20` and assert the emitted `data` deep-equals the input `data` (no key dropped) and `doc.schemaVersion === 2`.
`templates.test.ts`: rename "schema-v1" → "schema-v2"; add `expect(document.schemaVersion).toBe(2)` inside the loop.
`duplicate.test.ts` (Review Focus 3): `duplicates text and sticky nodes with their kind fields and id prefix` — input a text node `{ autoWidth: false }` and a sticky `{ color: '#FDE68A', text: { size: 'l', align: 'left', valign: 'top', bold: false } }`; assert copies' ids match `/^text_/` and `/^sticky_/`, `data` deep-equals the originals, and `data` objects are not the same references.
`large-fixture.test.ts`: title "schema-v2".
`canvas-route.test.ts` (AC-021): `EMPTY.schemaVersion` → 2; in the owner/editor PUT case expect `schemaVersion: 2` in the body, `h.putCanvas` called with `{ ...small, schemaVersion: 2 }`, `row.canvasSchemaVersion` 2; the GET case expects `{ document: { ...small, schemaVersion: 2 }, savedAt: null, schemaVersion: 2 }` (the v1 fixture is the PUT body on purpose: it is the "v1 body is migrated on write" case).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/canvas/serialize.test.ts tests/unit/canvas/templates.test.ts tests/unit/canvas/duplicate.test.ts`
Expected: FAIL (schemaVersion 1 emitted; `autoWidth` dropped by the allowlist).

- [ ] **Step 3: Implement**

`serialize.ts`: `persistNode` copies `data: { ...node.data }` (the schema's `.strict()` is the allowlist for `data`; top-level runtime keys are still never emitted), sizes fall back to `DEFAULT_SIZES[node.data.shape] ?? DEFAULT_SIZES.rectangle`, and spreads `parentId`/`extent` only when defined; `fromDocument` mirrors that. `templates.ts`: no behaviour change (`NodeSpec` keeps `NodeShape`; `instantiateTemplate` compiles because `newNodeId` takes `NodeKind`). `factories.ts`: `schemaVersion: 2`. `gen-large-fixture.mjs`: `schemaVersion: 2`, then run `node scripts/gen-large-fixture.mjs`. Compile fixes: `canvas-node.tsx` `knownVisuals` returns `shape: isNodeShape(data.shape) ? data.shape : 'rectangle'` and passes `data.color` through; `shape-renderer.tsx` takes `color: NodeColor` and uses `resolveColor(color)` (fill/text) — this is also FR-017 for shapes; `node-resizer.tsx` uses `MIN_SIZES[shape]`.

- [ ] **Step 4: Regenerate template fixtures and run the suites**

Run: `npx vitest run tests/unit/canvas/templates.test.ts -u` then `git diff --stat tests/fixtures/canvas/templates`
Expected: three files, one changed line each (`"schemaVersion": 2`).
Run: `npx vitest run tests/unit tests/integration/api/canvas-route.test.ts`
Expected: PASS (route suite is skipped without `DATABASE_URL_TEST`; run it with the agent's own schema).

- [ ] **Step 5: Quality gate and commit C1**

Run: `npm run check > "$SCRATCH/check-c1.log" 2>&1; tail -20 "$SCRATCH/check-c1.log"`
Expected: `tsc` clean, eslint clean, vitest all passed, `prisma validate` ok.

```bash
git add types/canvas.ts lib/canvas/ids.ts lib/canvas/color.ts lib/canvas/schema.ts lib/canvas/serialize.ts lib/canvas/templates.ts \
  components/canvas/nodes/canvas-node.tsx components/canvas/nodes/shape-renderer.tsx components/canvas/nodes/node-resizer.tsx \
  scripts/gen-large-fixture.mjs tests/factories.ts tests/fixtures/canvas tests/unit/canvas tests/unit/fixtures tests/integration/api/canvas-route.test.ts
git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit -m "feat(canvas): schema v2 — ten kinds, reserved fields, migrateV1ToV2, shared colour module, v2 fixtures"
git log -1 --format='%an <%ae>%n%cn <%ce>%n%B'
```
Expected: both identity lines `krishna <krishnagtkr@gmail.com>`; body has no `Co-Authored-By`.

---

### Task 4: Kind dispatch, shape node, reserved placeholder, drag ghost

**Files:**
- Modify: `components/canvas/nodes/canvas-node.tsx` (becomes the dispatcher)
- Create: `components/canvas/nodes/shape-node.tsx`, `components/canvas/nodes/reserved-kind-node.tsx`, `components/canvas/nodes/warn-once.ts`
- Create: `lib/canvas/text-style.ts`
- Modify: `components/canvas/nodes/node-label.tsx:17-24`, `components/canvas/shape-drag-ghost.tsx`
- Test: `tests/unit/components/canvas/reserved-kind-node.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`NodeKind`, `isNodeShape`, `isNodeKind`, `DEFAULT_TEXT`, `TEXT_SIZE_PX`, `resolveColor`).
- Produces:
  - `lib/canvas/text-style.ts`: `interface TextStyle { fontSize: number; lineHeight: number; fontWeight: 400 | 600; textAlign: 'left' | 'center' | 'right' }`; `effectiveText(kind: NodeKind, data: { text?: TextOptions }): TextOptions` (= `data.text ?? DEFAULT_TEXT[kind]`); `textStyle(options: TextOptions): TextStyle` (fontSize `TEXT_SIZE_PX[size]`, lineHeight 1.3, weight 600 when bold).
  - `warn-once.ts`: `warnOnce(id: string, message: string): void`.
  - `canvas-node.tsx`: `kindOf(id: string, data: CanvasNodeData): NodeKind` (unknown → `'rectangle'` + one warning); `export const CanvasNode = memo(CanvasNodeImpl)` unchanged.
  - `shape-node.tsx`: `ShapeNode(props: NodeProps<CanvasNodeType> & { shape: NodeShape })`.
  - `reserved-kind-node.tsx`: `ReservedKindNode(props: NodeProps<CanvasNodeType> & { kind: 'line' | 'freehand' | 'frame' | 'image' })`.
  - `node-label.tsx`: `NodeLabelProps` gains `style?: CSSProperties`.
  - Placeholders for Tasks 7/8: `TextNode` and `StickyNode` are imported by the dispatcher — in this task create them as two-line stubs rendering `<ShapeNode {...props} shape="rectangle" />` so the switch compiles; Tasks 7 and 8 replace them.

- [ ] **Step 1: Write the failing tests** in `tests/unit/components/canvas/reserved-kind-node.test.tsx`, using the `renderCanvas` harness of `tests/unit/components/node-label-editor.test.tsx:10-50` (real `nodeTypes` in a real `<ReactFlow>`; `DOMMatrixReadOnly` shim), with a `nodes` argument:

```ts
it('renders frame and image as a deletable placeholder with no handles and no editor (AC-017)', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { container, onNodesChange } = renderCanvas({ nodes: [frameNode, imageNode] }); // frame: { shape:'frame', clip:false }, image: { shape:'image', image:{…} }
  for (const id of [frameNode.id, imageNode.id]) {
    const wrapper = container.querySelector(`.react-flow__node[data-id="${id}"]`)!;
    expect(wrapper).toHaveTextContent('Not supported in this version');
    expect(wrapper.querySelectorAll('.react-flow__handle')).toHaveLength(0);
    fireEvent.doubleClick(wrapper.firstElementChild!);
    expect(screen.queryByRole('textbox', { name: 'Node label' })).toBeNull();
  }
  expect(container.querySelector('[data-id="' + frameNode.id + '"]')).toHaveTextContent('frame');
  expect(warn).toHaveBeenCalledTimes(2);
  // deletable: selecting then calling the store's onDelete path is F10's job; here the node must be selectable
  fireEvent.click(container.querySelector(`.react-flow__node[data-id="${frameNode.id}"]`)!);
  expect(onNodesChange).toHaveBeenCalledWith([expect.objectContaining({ type: 'select', id: frameNode.id, selected: true })]);
});
it('renders an unknown shape string as a rectangle with one warning', () => { /* { shape: 'zigzag' } → [data-shape="rectangle"] present; warn once */ });
it('renders a hex colour on a shape through resolveColor (Review Focus 4)', () => {
  const { container } = renderCanvas({ nodes: [{ ...rect, data: { label: 'x', shape: 'rectangle', color: '#FDE68A' } }] });
  const box = container.querySelector<HTMLElement>('[data-shape="rectangle"]')!;
  expect(box.style.background).toMatch(/#FDE68A|rgb\(253, 230, 138\)/i);
  expect(box.style.color).toMatch(/#000000|rgb\(0, 0, 0\)/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/components/canvas/reserved-kind-node.test.tsx`
Expected: FAIL — placeholder text absent; handles rendered.

- [ ] **Step 3: Implement**

Move today's `CanvasNodeImpl` body (`canvas-node.tsx:38-82`) into `shape-node.tsx` as `ShapeNode`, passing `style={textStyle(effectiveText(shape, data))}` to `NodeLabel` and the editor (defaults equal `LABEL_TYPOGRAPHY`, so shapes do not change visually). `canvas-node.tsx` keeps `onControl`? — no, it moves with the body; the dispatcher is `kindOf` + an exhaustive `switch` over `NodeKind` (six shape cases → `ShapeNode`, `text` → `TextNode`, `sticky` → `StickyNode`, four reserved → `ReservedKindNode`, `default: never`). `ReservedKindNode`: root `<div aria-label={`${kind} (unsupported)`} className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[4px] border border-dashed border-surface-subtle text-xs text-copy-faint select-none">` with the kind name and the copy "Not supported in this version"; `warnOnce(id, …)` in render; no handles, no resizer, no double-click handler. `ShapeDragGhost`: `drag.shape === 'text'` → a `text-copy-faint font-sans text-sm` "Text" word in a transparent box; `'sticky'` → `rounded-[4px]` box with `background: resolveColor('orange').fill` and a dashed brand border; else `ShapeRenderer`.

- [ ] **Step 4: Run the tests and the F07/F08 suites**

Run: `npx vitest run tests/unit/components`
Expected: PASS, including the unchanged `node-label-editor.test.tsx` and `node-color-toolbar.test.tsx`.

---

### Task 5: Creation paths — mutations, palette, `T`/`N` shortcuts (commit C2)

**Files:**
- Modify: `hooks/useCanvasMutations.ts`, `hooks/useCanvasActions.ts`, `hooks/useKeyboardShortcuts.ts:9-27`, `hooks/useShapeDrag.ts`, `hooks/useSelectedNodeIds.ts:22-38`
- Create: `lib/canvas/pending-editor.ts`, `lib/canvas/focus-node.ts`
- Modify: `lib/canvas/shortcuts.ts`, `components/canvas/shape-palette.tsx`
- Test: `tests/unit/hooks/useCanvasMutations.test.tsx`, `tests/unit/canvas/shortcuts.test.ts`, `tests/unit/components/canvas/shape-palette.test.tsx` (create)

**Interfaces:**
- Consumes: Task 1 (`PaletteKind`, `DEFAULT_SIZES`, `isNodeShape`, `NodeDataPatch`), `centredDropPosition` (existing).
- Produces:
  - `useCanvasMutations`: `addNodeOfKind(kind: 'text' | 'sticky', position: XYPosition, init?: { label?: string }): CanvasNode | null`; `commitTextNode(id: string, patch: TextCommitPatch): void` with `export type TextCommitPatch = { label?: string; width?: number; height?: number; autoWidth?: boolean }` (one `replace`; `autoWidth` is written only for text nodes); `updateNodeData(id, patch: NodeDataPatch)`, `updateNodesData(ids, patch: NodeDataPatch)`; `addNode(shape: NodeShape, …)` unchanged.
  - `lib/canvas/pending-editor.ts`: `requestEditorOpen(id: string): void`; `takeEditorOpen(id: string): boolean` (true exactly once per request).
  - `lib/canvas/focus-node.ts`: `focusNodeWhenRendered(container: HTMLElement | null, id: string): void` (body = today's `shape-palette.tsx:12-18`).
  - `lib/canvas/shortcuts.ts`: `ShortcutAction` + `'addText' | 'addSticky'`; both in `MUTATING`; `formatKeys` → `'T'` / `'N'`; `SHORTCUT_ROWS` gains `{ action: 'Add text', input: '`T` — type; Enter commits, Esc removes an empty text', viewerVisible: false }` and `{ action: 'Add sticky note', input: '`N`', viewerVisible: false }` inserted after `'Duplicate'`.
  - `useCanvasActions`: `addText(): void`, `addSticky(): void`.
  - `useShapeDrag`: `ShapeDragState.shape: PaletteKind`; `onDrop(kind: PaletteKind, client)`, `onPlace(kind: PaletteKind)`, `buttonProps(kind: PaletteKind)`.
  - `shape-palette.tsx`: `export const PALETTE_ITEMS: readonly PaletteKind[] = [...NODE_SHAPES, 'text', 'sticky']`.

- [ ] **Step 1: Write the failing tests**

`useCanvasMutations.test.tsx` (same `setup(writable)` harness):
```ts
it('addNodeOfKind creates a text node 24×20 with autoWidth and flags its editor to open', () => {
  const { result, onNodesChange } = setup(true);
  const node = result.current.mutations.addNodeOfKind('text', { x: 5, y: 6 })!;
  expect(node).toMatchObject({ width: 24, height: 20, data: { label: '', shape: 'text', color: 'neutral', autoWidth: true } });
  expect(node.id).toMatch(/^text_/);
  expect(takeEditorOpen(node.id)).toBe(true);
  expect(takeEditorOpen(node.id)).toBe(false);
  expect(onNodesChange.mock.calls[1]).toEqual([[{ type: 'select', id: node.id, selected: true }]]);
});
it('addNodeOfKind creates a 250×250 orange sticky; an initial label skips the editor flag', () => {
  const sticky = result.current.mutations.addNodeOfKind('sticky', { x: 0, y: 0 })!;
  expect(sticky).toMatchObject({ width: 250, height: 250, data: { label: '', shape: 'sticky', color: 'orange' } });
  expect(takeEditorOpen(sticky.id)).toBe(false);
  const pasted = result.current.mutations.addNodeOfKind('text', { x: 0, y: 0 }, { label: 'pasted' })!;
  expect(pasted.data.label).toBe('pasted');
  expect(takeEditorOpen(pasted.id)).toBe(false);
});
it('commitTextNode writes label, width, height and autoWidth in one replace', () => {
  // seed the store with a text node via setState({ nodes: [...] }) then:
  result.current.mutations.commitTextNode(id, { label: 'Hi', width: 120, height: 24, autoWidth: false });
  expect(onNodesChange).toHaveBeenCalledTimes(1);
  expect(onNodesChange.mock.calls[0][0]).toEqual([{ type: 'replace', id, item: expect.objectContaining({ width: 120, height: 24, data: { label: 'Hi', shape: 'text', color: 'neutral', autoWidth: false } }) }]);
});
it('addNodeOfKind and commitTextNode are silent no-ops for read-only members', () => { /* setup(false): null / no call */ });
```
`shortcuts.test.ts`: add to the mapping test `expect(matchShortcut(key('t'))).toBe('addText'); expect(matchShortcut(key('n'))).toBe('addSticky'); expect(matchShortcut(key('t', { ctrlKey: true }))).toBeNull(); expect(matchShortcut(key('T', { shiftKey: true }))).toBeNull(); expect(MUTATING.has('addText') && MUTATING.has('addSticky')).toBe(true);` and update the cheat-sheet assertion to `['Select all', 'Duplicate', 'Add text', 'Add sticky note', 'Clear selection', 'Keyboard shortcuts']`.
`shape-palette.test.tsx` (AC-007): render `<TooltipProvider><ReactFlowProvider><ShapePalette /></ReactFlowProvider></TooltipProvider>` with `vi.mock('@/hooks/useCanvasMutations')` returning `{ canEdit: true, addNode, addNodeOfKind }` spies and a store `domNode` stub (`getBoundingClientRect → { left: 0, top: 0, width: 800, height: 600 }`):
```ts
it('shows eight items in order, the last two for text and sticky', () => {
  expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Add rectangle', 'Add diamond', 'Add circle', 'Add pill', 'Add cylinder', 'Add hexagon', 'Add text', 'Add sticky note']);
  expect(screen.getByRole('separator')).toBeInTheDocument();
});
it('clicking "Add text" calls addNodeOfKind with the viewport centre, top-left adjusted for 24×20', async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Add text' }));
  expect(addNodeOfKind).toHaveBeenCalledWith('text', { x: 400 - 12, y: 300 - 10 });
  expect(addNode).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/hooks/useCanvasMutations.test.tsx tests/unit/canvas/shortcuts.test.ts tests/unit/components/canvas/shape-palette.test.tsx`
Expected: FAIL — `addNodeOfKind is not a function`; `matchShortcut('t')` null; 6 buttons.

- [ ] **Step 3: Implement the mutations and helpers**

`addNodeOfKind`: same shape as `addNode` (add → unselect all → select) with `data` = `{ label: init?.label ?? '', shape: 'text', color: 'neutral', autoWidth: true }` or `{ label, shape: 'sticky', color: 'orange' }`; after the add, `if (kind === 'text' && !init?.label) requestEditorOpen(item.id)`. `commitTextNode`: read `nodeLookup.get(id)?.internals.userNode`, no-op when missing, emit one `replace` with `width`/`height` overridden when given and `data: { ...node.data, ...(label !== undefined && { label }), ...(autoWidth !== undefined && node.data.shape === 'text' && { autoWidth }) }`. `pending-editor.ts`: module-level `Set<string>`. `useSelectionColor`: treat a hex (`isHexColor`) like a mixed selection (`return null`).

- [ ] **Step 4: Implement shortcuts and actions**

`matchShortcut` (no-mod branch, before the `switch`): `if (!shift && key === 't') return 'addText'; if (!shift && key === 'n') return 'addSticky';`. `useKeyboardShortcuts.run`: `'addText' → actions.addText()`, `'addSticky' → actions.addSticky()`. `useCanvasActions.addText/addSticky`: `if (!canEdit) return;` centre = `rf.screenToFlowPosition` of the `store.getState().domNode` rect centre; `mutations.addNodeOfKind(kind, centredDropPosition(centre, DEFAULT_SIZES[kind]))`; for sticky, `focusNodeWhenRendered(domNode, node.id)` (text focuses its own textarea).

- [ ] **Step 5: Implement the palette and drag hook**

Widen `useShapeDrag` to `PaletteKind` (no logic change — `DEFAULT_SIZES[kind]` already covers it). `shape-palette.tsx`: map over `PALETTE_ITEMS`; `ICONS` adds `text: Type`, `sticky: StickyNote` (`lucide-react`); `aria-label` `Add text` / `Add sticky note`; tooltips `Text — click to place, or press T` / `Sticky note — click to place, or press N`; a `<span role="separator" aria-orientation="vertical" className="mx-0.5 w-px self-stretch bg-surface-border" />` before the text item; `createAt(kind, client)` → `isNodeShape(kind) ? addNode(kind, pos) : addNodeOfKind(kind, pos)`; focus the new node unless `kind === 'text'`. Import `focusNodeWhenRendered` from `lib/canvas/focus-node.ts`.

- [ ] **Step 6: Run the tests, then the whole unit suite**

Run: `npx vitest run tests/unit`
Expected: PASS (`useShapeDrag.test.tsx`, `useKeyboardShortcuts.test.tsx`, `flow-canvas.test.tsx` unchanged and green).

- [ ] **Step 7: Quality gate and commit C2**

Run: `npm run check > "$SCRATCH/check-c2.log" 2>&1; tail -20 "$SCRATCH/check-c2.log"` → all green.
```bash
git add components/canvas/nodes components/canvas/shape-palette.tsx components/canvas/shape-drag-ghost.tsx hooks lib/canvas/text-style.ts lib/canvas/pending-editor.ts lib/canvas/focus-node.ts lib/canvas/shortcuts.ts tests/unit
git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit -m "feat(canvas): kind dispatch with reserved-kind placeholder; text and sticky creation via palette and T/N"
```

---

### Task 6: Text measurement module and editor/resizer props

**Files:**
- Create: `lib/canvas/text-measure.ts`, `components/canvas/nodes/text-measure-context.ts`
- Modify: `components/canvas/nodes/node-label-editor.tsx`, `components/canvas/nodes/node-resizer.tsx`
- Test: `tests/unit/canvas/text-measure.test.ts`

**Interfaces:**
- Consumes: Task 4 `TextStyle`.
- Produces:
  - `lib/canvas/text-measure.ts`: `export const TEXT_PADDING = { x: 6, y: 4 } as const; export const STICKY_PADDING = { x: 12, y: 12 } as const;` `export interface MeasureInput { text: string; style: TextStyle; padding: { x: number; y: number }; width?: number }` (`width` = border-box width to wrap at; absent = no wrapping); `measureText(input: MeasureInput, doc?: Document): { width: number; height: number }` — **border-box** size (content + 2·padding), `Math.ceil`; `fontsReady(doc?: Document): Promise<void>` cached per document.
  - `text-measure-context.ts`: `export type Measurer = (input: MeasureInput) => Promise<{ width: number; height: number }>`; `export const TextMeasureContext = createContext<Measurer | null>(null)`; `export function useTextMeasure(): Measurer` (context value, else `async (i) => { await fontsReady(); return measureText(i); }`).
  - `NodeLabelEditorProps` additive, all optional: `maxLength?: number` (default `LABEL_MAX_LENGTH`), `className?: string` (textarea classes; default `LABEL_TYPOGRAPHY`), `style?: CSSProperties`, `wrapperClassName?: string` (default `'absolute inset-0 flex items-center justify-center'`), `placeholder?: string` (default `'Label'`), `onDraftChange?(value: string): void`.
  - `CanvasNodeResizerProps`: `{ kind: NodeKind; sides?: 'all' | 'horizontal'; onResizeEnd?: OnResizeEnd }` (`OnResizeEnd` from `@xyflow/react`); min sizes from `MIN_SIZES[kind]`; `keepAspectRatio` when `kind === 'circle'`; `'horizontal'` renders two `NodeResizeControl`s (`variant={ResizeControlVariant.Line}`, `position="left"` / `"right"`, `minWidth={MIN_SIZES.text.width}`, `className="canvas-resize-line"`).

- [ ] **Step 1: Write the failing tests** in `tests/unit/canvas/text-measure.test.ts` (jsdom):

```ts
it('measures a hidden body-level mirror and returns the ceiled border-box size', () => {
  const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 108.2, height: 15.6 } as DOMRect);
  expect(measureText({ text: 'Hello world', style, padding: { x: 6, y: 4 } })).toEqual({ width: 109, height: 16 });
  const mirror = document.querySelector<HTMLElement>('[data-slot="text-mirror"]')!;
  expect(mirror.style.whiteSpace).toBe('pre');
  expect(mirror.style.padding).toBe('4px 6px');
  expect(mirror.style.fontSize).toBe('14px');
  measureText({ text: 'wrap me', style, padding: { x: 12, y: 12 }, width: 250 });
  expect(mirror.style.whiteSpace).toBe('pre-wrap');
  expect(mirror.style.width).toBe('250px');
  expect(document.querySelectorAll('[data-slot="text-mirror"]')).toHaveLength(1);
  spy.mockRestore();
});
it('fontsReady awaits document.fonts.ready once and caches the promise (EC-005)', async () => {
  const ready = Promise.resolve();
  Object.defineProperty(document, 'fonts', { value: { ready }, configurable: true });
  expect(fontsReady()).toBe(fontsReady());
  await expect(fontsReady()).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/canvas/text-measure.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `text-measure.ts`**

One lazily created `<span data-slot="text-mirror" aria-hidden="true" class="font-sans">` on `document.body` with `position: absolute; left: -99999px; top: 0; visibility: hidden; pointer-events: none; box-sizing: border-box; overflow-wrap: break-word`. Per call set `fontSize`, `lineHeight`, `fontWeight`, `padding`, `whiteSpace` (`pre` without `width`, `pre-wrap` with), `width` (`auto` or `${width}px`), `textContent = text || ' '`, read `getBoundingClientRect()`. The mirror sits outside the React Flow transform on purpose: no zoom division (02-design's in-node mirror would need `getZoom()`; this is the simpler equivalent). `fontsReady`: `doc.fonts?.ready ?? Promise.resolve()`, cached in a `WeakMap<Document, Promise<void>>`.

- [ ] **Step 4: Implement the editor and resizer props**

`NodeLabelEditor`: thread the new props through (`maxLength`, `className` replacing `LABEL_TYPOGRAPHY`, `style`, `wrapperClassName`, `placeholder`); call `onDraftChange?.(value)` inside `onChange`. `CanvasNodeResizer`: rename `shape` → `kind` and update the two callers (`shape-node.tsx`, tests).

- [ ] **Step 5: Run the affected suites**

Run: `npx vitest run tests/unit/canvas/text-measure.test.ts tests/unit/components`
Expected: PASS; `node-label-editor.test.tsx` unchanged (defaults preserve F08 behaviour).

---

### Task 7: Text node (commit C3)

**Files:**
- Create: `components/canvas/nodes/text-node.tsx` (replaces the Task 4 stub)
- Modify: `app/globals.css` (append `.canvas-text-node` rules)
- Test: `tests/unit/components/canvas/text-node.test.tsx`

**Interfaces:**
- Consumes: Task 5 `commitTextNode`, `onDelete`, `takeEditorOpen`; Task 6 `useTextMeasure`, `TEXT_PADDING`, `NodeLabelEditor` props, `CanvasNodeResizer({ kind: 'text', sides: 'horizontal', onResizeEnd })`; Task 4 `effectiveText`, `textStyle`; Task 1 `resolveColor`, `isHexColor`, `TEXT_MAX_LENGTH`.
- Produces: `TextNode(props: NodeProps<CanvasNodeType>)` where `props.data.shape === 'text'`; DOM contract: root `div.canvas-text-node[data-kind="text"]` with `aria-label="text ${label || 'empty'}"`, `white-space: pre` (autoWidth) / `pre-wrap` (fixed), inline `color`, no `.react-flow__handle`, no background/border; empty + `canEdit` → `[data-slot="node-label-placeholder"]` text "Text" in `text-copy-faint`; editor textarea `aria-label="Node label"`, `maxLength=500`.

- [ ] **Step 1: Write the failing tests** in `tests/unit/components/canvas/text-node.test.tsx` — the `renderCanvas` harness wrapped in `<TextMeasureContext.Provider value={measure}>`, where `measure = vi.fn(async ({ text }) => text.trim() === '' ? { width: 24, height: 20 } : { width: 120, height: 24 })`; `commits()` = replace changes from `onNodesChange`; `deletes` = spy on the store's `onDelete` (set `onDelete` in the store via `setState` as the harness sets `onNodesChange`):

```ts
it('renders at rest with no fill, border or handles, pre whitespace and the palette text colour (AC-009)', () => {
  const { root } = renderText({ label: 'Hello', color: 'blue' });
  expect(root).toHaveAttribute('aria-label', 'text Hello');
  expect(root.style.background).toBe(''); expect(root.style.border).toBe('');
  expect(root.querySelectorAll('.react-flow__handle')).toHaveLength(0);
  expect(root.querySelector('[data-slot="node-label"]')).toHaveStyle({ whiteSpace: 'pre', color: '#52A8FF' });
});
it('renders a hex colour as the text colour itself and the "Text" placeholder for editors only', () => {
  expect(renderText({ label: '', color: '#FDE68A' }).root.querySelector('[data-slot="node-label-placeholder"]')).toHaveTextContent('Text');
  expect(renderText({ label: 'x', color: '#FDE68A' }).root.querySelector('[data-slot="node-label"]')).toHaveStyle({ color: '#FDE68A' });
  expect(renderText({ label: '', color: 'neutral', canEdit: false }).root.querySelector('[data-slot="node-label-placeholder"]')).toHaveTextContent('');
});
it('opens on creation, measures after fonts are ready and commits label + size in one replace (AC-010)', async () => {
  requestEditorOpen(ID);
  const { commits } = renderText({ label: '' });
  const textarea = await screen.findByRole('textbox', { name: 'Node label' });
  expect(textarea).toHaveFocus(); expect(textarea.maxLength).toBe(500);
  await user.type(textarea, 'Hello world{Enter}');
  await waitFor(() => expect(commits()).toHaveLength(1));
  expect(commits()[0].item).toMatchObject({ width: 120, height: 24, data: { label: 'Hello world', autoWidth: true } });
  expect(measure).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Hello world', padding: { x: 6, y: 4 }, width: undefined }));
});
it('caps a 1000-character paste at 500 and still writes once (EC-010)', async () => { /* user.paste('x'.repeat(1000)) → value length 500; Enter → one commit */ });
it('deletes a never-labelled node on blur or Escape, and a labelled node committed empty (AC-013)', async () => {
  // blur: requestEditorOpen → render → fireEvent.blur(textarea) → deletes called once with { nodes: [objectContaining({ id: ID })], edges: [] }, no replace
  // escape: same with user.keyboard('{Escape}')
  // label 'x' → open → clear → Enter → deletes once
});
it('deletes the node when the committed label is whitespace only (Review Focus 2)', async () => { /* type '  \n ' (Shift+Enter) → Enter → deletes once, commits 0 */ });
it('writes nothing when label and measured size are unchanged (Review Focus 1)', async () => {
  // node { label: 'Hello world', width: 120, height: 24 }; dblclick → Enter → commits() length 0, deletes 0
});
it('Escape keeps an existing label without a write and no delete (AC-012 unit half)', async () => { /* label 'Keep' → type 'Changed' → Escape → 0 commits, 0 deletes, label text 'Keep' */ });
it('wraps and re-measures only height when autoWidth is false', async () => {
  // node { autoWidth: false, width: 100, height: 24 }, measure → { width: 100, height: 48 }; dblclick, Enter → replace { width: 100, height: 48 }; label span whiteSpace 'pre-wrap'; measure called with width: 100
});
it('shows only the left/right line controls when selected by an editor', () => {
  // selected: true → .react-flow__resize-control.line.left and .line.right exist; .handle controls absent; canEdit=false → none
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/components/canvas/text-node.test.tsx`
Expected: FAIL (stub renders a rectangle with handles).

- [ ] **Step 3: Implement `text-node.tsx`**

State: `editing` (initial `canEdit && takeEditorOpen(id)`), `draftSize` (local, while editing), `neverHadText` ref (= `data.label === ''` when the editor opened and no commit since). Rest render: root `div.canvas-text-node` (`h-full w-full`, `style={{ color }}` where `color = isHexColor(data.color) ? data.color : resolveColor(data.color).text`), `NodeLabel` with `style={textStyle(effectiveText('text', data))}` and `className` giving `px-1.5 py-1` (4 px 6 px) + `whitespace-pre overflow-visible` or `whitespace-pre-wrap break-words`; no `ShapeRenderer`, no `NodeHandles`. Editor: `NodeLabelEditor` with `maxLength={TEXT_MAX_LENGTH}`, same classes/style, `wrapperClassName="absolute inset-0"`, `placeholder="Text"`, `onDraftChange` → `measure` → `setDraftSize` (auto: both; fixed: height). While editing, root `style.minWidth/minHeight = draftSize`. Commit/cancel/resize-end follow 02-design "Text node lifecycle" exactly, with the Review-Focus-1 guard (`label === data.label && size.width === width && size.height === height → no write`) and the node for `onDelete` read from `useStoreApi().getState().nodeLookup` (missing → no-op, EC-009). Enter-on-wrapper opens the editor (same listener as `shape-node.tsx`). `globals.css`: `.react-flow__node:hover .canvas-text-node { outline: 1px solid var(--border-subtle); }` and `.react-flow__node.selected .canvas-text-node { outline: 2px solid var(--accent-primary); }`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/components/canvas/text-node.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 5: Quality gate and commit C3**

Run: `npm run check > "$SCRATCH/check-c3.log" 2>&1; tail -20 "$SCRATCH/check-c3.log"` → green.
```bash
git add lib/canvas/text-measure.ts components/canvas/nodes/text-measure-context.ts components/canvas/nodes/text-node.tsx components/canvas/nodes/node-label-editor.tsx components/canvas/nodes/node-resizer.tsx components/canvas/nodes/shape-node.tsx app/globals.css tests/unit/canvas/text-measure.test.ts tests/unit/components/canvas/text-node.test.tsx
git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit -m "feat(canvas): text node — auto-width and fixed-width text, side resize, empty-delete, DOM measurer"
```

---

### Task 8: Sticky note and the text-option contract (commit C4)

**Files:**
- Create: `components/canvas/nodes/sticky-node.tsx` (replaces the Task 4 stub)
- Modify: `app/globals.css` (append `.canvas-sticky-node`)
- Test: `tests/unit/components/canvas/sticky-node.test.tsx`

**Interfaces:**
- Consumes: Task 5 `commitTextNode`; Task 6 `useTextMeasure`, `STICKY_PADDING`, `CanvasNodeResizer({ kind: 'sticky' })`; Task 4 `effectiveText`/`textStyle`; `NodeHandles`; Task 1 `resolveColor`, `TEXT_MAX_LENGTH`.
- Produces: `StickyNode(props: NodeProps<CanvasNodeType>)`; DOM contract: root `div.canvas-sticky-node[data-kind="sticky"]` with `aria-label="sticky note ${label || 'unlabelled'}"`, inline `backgroundColor`/`color` from `resolveColor`, `border-radius: 4px`, selected → `2px solid var(--accent-primary)` border, four `.react-flow__handle`, label `whitespace-pre-wrap` left/top in `p-3`, `overflow-hidden`, placeholder "Double-click to label".
- Contract for F08 v2 (already exported; nothing new here): `TEXT_OPTION_KINDS`, `DEFAULT_TEXT`, `DEFAULT_BORDER`, `TEXT_SIZE_PX` (`types/canvas.ts`), `effectiveText`, `textStyle` (`lib/canvas/text-style.ts`), `NodeDataPatch` for `updateNodesData(ids, { text })`. **AC-016 / T-006 remains blocked** until `components/canvas/node-properties-toolbar.tsx` is on `main`; record that in `status.md` in Task 10.

- [ ] **Step 1: Write the failing tests** in `tests/unit/components/canvas/sticky-node.test.tsx` (same harness; `measure = vi.fn(async ({ text, padding }) => ({ width: 250, height: (text.length > 20 ? 400 : 100) + 2 * padding.y }))` — i.e. 400 px of content for a long label):

```ts
it('renders a new sticky 250×250 in orange with shadow, radius, four handles and left/top text (AC-014)', () => {
  const { root } = renderSticky({ label: '' });
  expect(root).toHaveAttribute('aria-label', 'sticky note unlabelled');
  expect(root).toHaveStyle({ backgroundColor: '#331B00', color: '#FF990A', borderRadius: '4px' });
  expect(root).toHaveClass('canvas-sticky-node'); // shadow lives in globals.css
  expect(root.querySelectorAll('.react-flow__handle')).toHaveLength(4);
  expect(root.querySelector('[data-slot="node-label-placeholder"]')).toHaveTextContent('Double-click to label');
  expect(root.querySelector('[data-slot="node-label-placeholder"]')).toHaveStyle({ textAlign: 'left' });
});
it('renders a hex fill with derived black text', () => { /* color '#FDE68A' → backgroundColor #FDE68A, color #000000 */ });
it('grows height to the content on commit, never shrinks, one replace (AC-015)', async () => {
  // dblclick → type 'a'.repeat(30) → Enter → one replace { height: 424, data.label } ; measure called with { width: 250, padding: { x: 12, y: 12 } }
  // then short label 'short' → Enter → replace carries data.label only and height unchanged (item.height === 424 from the rerendered node)
});
it('keeps an empty committed sticky (never auto-deleted) and writes nothing when unchanged', async () => { /* label '' → open → Enter → 0 replace, 0 onDelete */ });
it('Enter on the focused sticky wrapper opens the editor (Review Focus 5)', () => { /* wrapper.focus(); fireEvent.keyDown(wrapper, { key: 'Enter' }) → textbox present */ });
it('viewers get no editor, resizer or placeholder', () => { /* canEdit false, selected true → no textbox on dblclick, no .react-flow__resize-control, placeholder empty */ });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/components/canvas/sticky-node.test.tsx`
Expected: FAIL (stub).

- [ ] **Step 3: Implement `sticky-node.tsx`**

Root `div.canvas-sticky-node` (`relative flex h-full w-full overflow-hidden rounded-[4px] p-3`, `items-start justify-start` for `valign: 'top'`), inline `backgroundColor`/`color` from `resolveColor(data.color)`, `border: selected ? '2px solid var(--accent-primary)' : '2px solid transparent'`. `NodeLabel` with `style={textStyle(effectiveText('sticky', data))}`, classes `whitespace-pre-wrap break-words w-full` and no `line-clamp` (clip by the root's overflow). `CanvasNodeResizer kind="sticky"` when selected and `canEdit`; `NodeHandles` always. Editor: `NodeLabelEditor` with `maxLength={TEXT_MAX_LENGTH}`, `wrapperClassName="absolute inset-0 p-3"`, textarea classes left-aligned. Commit: `label = trim(value)`; `size = await measure({ text: label, style, padding: STICKY_PADDING, width })`; `height = Math.max(nodeHeight, size.height)`; write `commitTextNode(id, { label, ...(height !== nodeHeight && { height }) })` only if label or height changed; Escape closes without a write. `globals.css`: `.canvas-sticky-node { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45); }`.

- [ ] **Step 4: Run the tests and the whole unit suite**

Run: `npx vitest run tests/unit`
Expected: PASS.

- [ ] **Step 5: Quality gate and commit C4**

Run: `npm run check > "$SCRATCH/check-c4.log" 2>&1; tail -20 "$SCRATCH/check-c4.log"` → green.
```bash
git add components/canvas/nodes/sticky-node.tsx app/globals.css tests/unit/components/canvas/sticky-node.test.tsx
git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit -m "feat(canvas): sticky note — orange fill, four handles, 75 px minimum, auto-grow on commit"
```

---

### Task 9: End-to-end specs

**Files:**
- Modify: `tests/e2e/helpers/canvas.ts:34-59`
- Create: `tests/e2e/text-sticky.spec.ts`, `tests/e2e/text-sticky-collab.spec.ts`

**Interfaces:**
- Consumes: `openCanvas`, `dropShape`, `addShape`, `getViewport`, `two-users` fixture, `createProjectFor`/`addMember`/`deleteProject`, `deleteRoom`/`clearRoomStorage`, `[data-slot="save-button"]` (persistence.spec.ts:27-38), `window.__rf`, `window.__canvasMutations`, the `dragHandle` helper from `node-editing.spec.ts:30-41` (copy it).
- Produces: `paletteButton(page, kind: PaletteKind)` (label map `text → 'Add text'`, `sticky → 'Add sticky note'`), `startShapeDrag`/`dropShape`/`addShape` accepting `PaletteKind`; `pressKey(page, 't' | 'n')` = click an empty pane spot then `page.keyboard.press`.

- [ ] **Step 1: Write `tests/e2e/text-sticky.spec.ts`** (single editor, `beforeEach` project as in `node-editing.spec.ts:13-20`):

`'T and N create at the viewport centre; keys are ignored while editing or with Ctrl (AC-008, AC-007)'`:
- press `t` → one `.react-flow__node.selected`, `data-id` `/^text_/`, textbox focused; type `Hello`, Enter → `stored.label === 'Hello'`, `data.autoWidth === true`, `width >= 24`; node centre (`position + size/2`) within 1 px of `window.__rf.screenToFlowPosition(viewport centre)`; DOM box width equals `stored.width` ±1.
- press `n` → second node `/^sticky_/`, `width === 250 && height === 250`, `data.color === 'orange'`, selected.
- double-click the sticky, press `t` → still 2 nodes; Escape. `page.keyboard.press('Control+t')` → still 2 nodes.
- click "Add sticky note" → 3 nodes; `dropShape(page, 'sticky', { x: 700, y: 400 })` → new node centre within 1 px of `screenToFlowPosition({700,400})`.

`'side resize makes text fixed-width and wraps; a sticky never goes below 75×75 (AC-011)'`:
- `t`, type `a long sentence that will wrap when narrowed`, Enter; record `w0, h0`; `dragHandle(page, id, 'line.right', 120 - w0, 0)` → `expect.poll(stored)` → `width === 120`, `data.autoWidth === false`, `height > h0`; label span `white-space: pre-wrap` via `getComputedStyle`.
- `n`; `dragHandle(page, id, 'handle.bottom.right', -300, -300)` → `75 × 75`.

- [ ] **Step 2: Write `tests/e2e/text-sticky-collab.spec.ts`** (two-user fixture; the `afterEach` of `node-editing-collab.spec.ts:13-18`):

`'committed size reaches B unwrapped within 1 s and the v2 snapshot round-trips (AC-019)'`: A creates text `Deploy` (t) and sticky `Idea` (n, dblclick, type, Enter); for each id, `expect(node(b, id)).toBeVisible({ timeout: 1_000 })` and B's `boundingBox()` width/height (zoom 1) equal A's `stored` ±1; B's `[data-slot="node-label"]` height equals A's stored height − 8 (one line, no wrap). Then A clicks `[data-slot="save-button"]`, waits for `/^Saved/`; `clearRoomStorage(projectId)`; `a.reload()`; `openCanvas`; GET `/api/projects/${projectId}/canvas` → `schemaVersion === 2`, the two nodes present with identical `width/height/data`.

`'Escape keeps the label; Backspace edits only; B deleting under A's editor closes it without a write (AC-012)'`: text `Keep`; A dblclick → type `Changed` → Escape → `stored.label === 'Keep'` on A and B; A dblclick → Backspace ×2 → node count unchanged; A dblclick (editor open), B clicks the node and presses `Delete` → A's textbox count 0 within 2 s, both counts 0, stays 0 for 1 s, no `pageerror`/console error on A.

`'a viewer cannot create text or stickies by key or by the exposed mutation (AC-018)'`: `addMember(projectId, emailB, 'VIEWER')` (skip when `!distinctUsers`); `openCanvas(b, projectId, false)`; B presses `t`, `n`; `b.evaluate(() => window.__canvasMutations!.addNodeOfKind('text', { x: 0, y: 0 }))` resolves `null`; `a.waitForTimeout(2_000)` → A node count 0; B has no `toolbar[name="Shape palette"]`, no `.react-flow__resize-control`, no `radiogroup[name="Node colour"]`.

- [ ] **Step 3: Run the two specs locally**

Run (own port and schema): `E2E_PORT=3122 npx playwright test tests/e2e/text-sticky.spec.ts tests/e2e/text-sticky-collab.spec.ts > "$SCRATCH/e2e-f22.log" 2>&1; tail -30 "$SCRATCH/e2e-f22.log"`
Expected: `5 passed` (the viewer case may report `skipped` when `E2E_USER_B_*` is unset — record that).

---

### Task 10: Final verification, documentation evidence and commit C5

**Files:**
- Modify: `features/22-text-and-sticky-notes/status.md` (Evidence, Last verified, blocked T-006 note)
- Modify (only with owner authorisation): `context/domain-model.md:145` heading `PROPOSED → frozen`; `context/progress-tracker.md` F22 row

- [ ] **Step 1: Full quality gate**

Run: `npm run check > "$SCRATCH/check-final.log" 2>&1; tail -25 "$SCRATCH/check-final.log"`
Expected: `tsc` 0 errors; eslint 0 problems; vitest `Test Files N passed`, 0 failed; `prisma validate` ok.

- [ ] **Step 2: Production build (Cache Components check)**

Run: `npm run build > "$SCRATCH/build.log" 2>&1; tail -30 "$SCRATCH/build.log"`
Expected: `✓ Compiled`, route table printed, no `blocking-prerender-runtime` or `use cache` errors.

- [ ] **Step 3: Full e2e on the local stack**

Run: `E2E_PORT=3122 npm run e2e > "$SCRATCH/e2e-all.log" 2>&1; grep -E "passed|failed|skipped" "$SCRATCH/e2e-all.log" | tail -5`
Expected: all existing specs still pass (`shapes.spec.ts`, `node-editing*.spec.ts`, `persistence.spec.ts`, `perf.spec.ts` with the regenerated 500-node fixture) plus the two new ones; 0 failed.

- [ ] **Step 4: Scope, identity and attribution audit**

Run: `git diff --stat main..HEAD` — every path is in the File structure table; `No_touch_ai/`, `AGENTS.md`, `.env*` untouched.
Run: `git log main..HEAD --format='%h %an <%ae> | %cn <%ce> | %s'` — four commits so far, all `krishna <krishnagtkr@gmail.com>` both columns.
Run: `git log main..HEAD --format=%B | grep -ci 'co-authored\|generated with\|claude'` → `0`.

- [ ] **Step 5: Record evidence**

In `status.md`: `Last verified` = date + commit hash; Evidence = the `tail` lines of `check-final.log`, `build.log`, `e2e-all.log`; AC table: AC-001–015, 017–019, 021 verified (file + run), **AC-016 unmet — blocked on F08 v2 T-012 (`node-properties-toolbar.tsx` absent on `main`); F22 exports the contract (`TEXT_OPTION_KINDS`, `DEFAULT_TEXT`, `DEFAULT_BORDER`, `TEXT_SIZE_PX`, `effectiveText`, `textStyle`, `NodeDataPatch`)**; AC-020 manual screenshots (hover/selected text, sticky shadow, four sizes, bold — taken via the dev server) attached or listed as pending owner review. Ask the owner before editing `context/domain-model.md` and `context/progress-tracker.md` (CLAUDE.md §3 rule 9); if authorised, change only the heading and the row.

- [ ] **Step 6: Commit C5**

```bash
git add tests/e2e/helpers/canvas.ts tests/e2e/text-sticky.spec.ts tests/e2e/text-sticky-collab.spec.ts features/22-text-and-sticky-notes/status.md   # + authorised context files
git -c user.name=krishna -c user.email=krishnagtkr@gmail.com commit -m "test(e2e): text and sticky creation, resize, collaboration and viewer gates; F22 verification evidence"
git log -1 --format='%an <%ae>%n%cn <%ce>%n%B'
```
Expected: identity lines `krishna <krishnagtkr@gmail.com>`; no attribution trailer. Do **not** push; report per CLAUDE.md §9 and stop.

---

## Self-review (run 2026-10-28)

1. **Spec coverage** — FR-001/002/003/005 → Tasks 1–2; FR-004 → Task 1; FR-006 → Task 3 (+ AC-021 route case); FR-007 → Task 5; FR-008 → Task 5 (interim path; Task 0 step 3 re-checks the ordering rule); FR-009–013 → Task 7; FR-014/015 → Task 8; FR-016 → contract exports (Tasks 1, 4) + blocked note (Task 10); FR-017 → Task 3 (`ShapeRenderer`), Task 5 (`useSelectionColor`), Tasks 7–8; FR-018 → Task 4; FR-019 → Tasks 5, 7, 8 (viewer tests) + Task 9. AC-016 is the one AC no task can verify; it is recorded as unmet-blocked. Gap found and fixed inline: `serialize.ts`'s allowlist copy of `data` would have dropped `autoWidth`/`text` (Task 3 step 3 now spreads `data`).
2. **Step scan** — every code step names the file, signature and the pinned values; test steps carry names and assertions; no "handle edge cases" lines remain. The lifecycle algorithm is referenced from 02-design rather than transcribed.
3. **Type consistency** — `addNodeOfKind(kind, position, init?)`, `commitTextNode(id, patch: TextCommitPatch)`, `Measurer`/`MeasureInput` (border-box, `padding` field), `CanvasNodeResizer({ kind, sides, onResizeEnd })`, `effectiveText`/`textStyle`, `takeEditorOpen` are used with the same names in Tasks 5–9. Renamed `shape` → `kind` on the resizer is applied to both callers in Task 6 step 4.
4. **Review Focus** — five lines, each pinned: RF1/RF2 → Task 7 tests, RF3 → Task 3 (`duplicate.test.ts`), RF4 → Task 4 test, RF5 → Task 8 test.
5. **Proportion** — the plan is ~1.6× the spec package; code blocks are tests, signatures and commit commands only.

**Spec clarifications decided here (report to the owner):** (a) the measurer contract is border-box with an explicit `padding` input so AC-010 (`120 × 24` committed as-is) and AC-015 (`400` content → `424`) are both literal; (b) the mirror is a body-level singleton outside the React Flow transform, so no `getZoom()` division — same observable behaviour as 02-design's in-node mirror; (c) the schema type test becomes mutual `toMatchTypeOf` (the hand-written intersection union is not identity-equal to Zod's flat objects); (d) `useSelectionColor` treats a hex as "no shared palette colour" so the v1 colour toolbar renders without an active swatch until F08 v2.
