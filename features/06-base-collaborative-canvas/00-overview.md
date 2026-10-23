# F06 — Base Collaborative Canvas

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F04 (workspace island and chrome), F05 (`ProjectRoom`, global Liveblocks types, spike results) |
| Depended on by | F07, F08, F09, F10 (consume `useLiveblocksFlow` output, `CanvasNode`/`CanvasEdge`, `FlowCanvas` children slot), F11 (renders `<Cursors/>` inside `<ReactFlow>`), F13 (`CanvasDocumentSchema`, `toDocument`/`fromDocument`), F14 and F17 (validate against the same schema) |
| Product requirements | PRD-020, PRD-030 |
| Status | see status.md |

## Purpose

F06 replaces the F05 "Room connected" placeholder with the real canvas: a full-viewport React Flow surface whose nodes and edges live in Liveblocks Storage through `useLiveblocksFlow`, so that two members of a project see each other's nodes without refreshing. It also fixes the canvas schema (`types/canvas.ts`, `lib/canvas/schema.ts`, `lib/canvas/serialize.ts`) that every later feature — node creation, editing, edges, persistence, templates, the AI agent — validates against. It sits after F05 because it renders inside the room, and before F07–F13 because they all consume its types, schema, and the `FlowCanvas` component.

## Problem statement and goals

- Problem: the workspace has a room but nothing to collaborate on; later features would each invent their own node shape and serialisation unless one frozen schema exists first. The reference implementation shipped a canvas that looked like a floating card, auto-zoomed on the first drop, and let deletions bypass the collaborative state (`current-issues-liveblocks-canvas.md`, `current-issues-workspace-implementation.md`).
- G-1: Two editors in the same project see a node added by either within 1 s (PRD-030) without a page refresh.
- G-2: The canvas is flush and full-viewport with a dot background under the floating chrome (PRD-020); no border, radius, shadow, or card wrapper.
- G-3: `CanvasDocument` schema v1 is defined once, validated with Zod, serialised without runtime fields, and frozen on approval of this feature.
- G-4: Viewers get a non-mutating canvas (UI affordances off, server token read-only).
- G-5: The viewport never jumps after mount (no `fitView` after a drop — reference bug); the only later fits are user-invoked (F10 control, F14 template import for the importer — FR-009 exemptions).

## Scope

In scope:
- `@xyflow/react` (installed and pinned `~12.12` by F01, D-F01-1) and F01's stylesheet import in `app/globals.css` after `@import "tailwindcss"` — both verified, neither re-done.
- `types/canvas.ts`: `NODE_SHAPES`, `NODE_COLOR_IDS`, `NODE_COLORS`, `HANDLE_IDS`, `DEFAULT_SIZES`, `MIN_SIZE`, `CanvasNodeData`, `CanvasNode`, `CanvasEdgeData`, `CanvasEdge`, `PersistedNode`, `PersistedEdge`, `CanvasDocument`, `CANVAS_SCHEMA_VERSION`.
- `lib/canvas/schema.ts`: Zod `CanvasDocumentSchema` (v1), `MAX_NODES`/`MAX_EDGES`, `migrate(doc)` (no-op chain), `validateDocument(unknown)`.
- `lib/canvas/serialize.ts`: `toDocument(nodes, edges)`, `fromDocument(doc)`.
- `components/canvas/flow-canvas.tsx` (`'use client'`): `ReactFlowProvider` + `ReactFlow` wired to `useLiveblocksFlow`, interaction defaults, `Background`, `MiniMap`, read-only mode, children slot.
- Placeholder renderers `components/canvas/nodes/placeholder-node.tsx`, `components/canvas/edges/placeholder-edge.tsx` registered as module-level `nodeTypes`/`edgeTypes` (replaced in F07/F09 without changing the registry keys).
- Dev/test-only "add test node" affordance (removed by F07) so the feature is demonstrable before the palette exists.
- Unit tests for palette contrast, schema, serialisation; E2E: two users see each other's node.

Out of scope / non-goals:
- Shape palette and drop maths (F07); shape SVGs, label editing, colour toolbar, resize (F08); edge rendering, handles, labels (F09); keyboard shortcuts, Delete handling, control bar, context menu (F10); cursors/avatars (F11); autosave/seeding (F13); templates (F14). Viewport sync (never — data-ownership: viewport is client memory).

## User stories

- US-1: As an editor, I want the canvas to fill the window behind the sidebars so that it feels like an infinite design surface.
- US-2: As an editor, I want a node I add to appear on my collaborator's screen immediately so that we are working on one diagram.
- US-3: As a viewer, I want to pan and zoom the live diagram without being able to move or select anything so that I cannot accidentally change it.
- US-4: As an engineer on F07–F17, I want one schema and one serialiser so that templates, snapshots, and agent output are validated identically.
- US-5 (abuse): As a viewer whose UI somehow issues a mutation, I must be rejected by the Liveblocks server because my token is read-only (F05), not just by the UI.

## Key decisions referenced

- D-012 (Storage via `@liveblocks/react-flow`), D-013 (per-client undo), D-014 (deep `data` sync, label LWW), D-020 (interaction defaults), D-023 (`~12.12` pin), D-002 (schema frozen at F06).
- PROPOSED by this feature:
  - **P-06-1** `minZoom: 0.1`, `maxZoom: 4`. Rationale: React Flow defaults (0.5/2) cannot show a 500-node diagram (NFR-004) in one screen; 4× is enough to read 12 px labels on a 4K display; wider ranges make the MiniMap mask meaningless.
  - **P-06-2** The `fitView` prop is **not** used. Instead `onInit` calls `instance.fitView({ padding: 0.2, maxZoom: 1 })` once, only if there is at least one node at mount. Rationale: React Flow defers `fitView` until nodes have dimensions, so with an initially empty room the prop fires on the first drop — exactly the reference bug.
  - **P-06-3** Demonstrability before F07: a `DevAddNode` component rendered only when `process.env.NEXT_PUBLIC_E2E_HOOKS === '1'` or `NODE_ENV !== 'production'`, exposing a button `data-testid="dev-add-node"` that adds one rectangle node via `onNodesChange([{ type: 'add', item }])`. Rationale: a keyboard shortcut would collide with F10's shortcut map and is hard to discover in tests; Storage seeding via the dev server is possible but would test the dev server, not our hook. F07 deletes this component.
  - **P-06-4** Viewer read-only mode sets `nodesDraggable`, `nodesConnectable`, `elementsSelectable`, `edgesReconnectable` to `false` and `canWrite = role !== 'viewer' && useSelf(me => me.canWrite)`. Rationale: both signals must agree; a stale `role` prop can never grant write.
  - **P-06-5** Schema enforces id formats (`${shape}_${ulid}`, `e_${ulid}`), handle ids, finite positions, `width ≥ 48`/`height ≥ 32`, label ≤ 500 chars, referential integrity of edges, no self-loops, no duplicate ids. Rationale: the same schema gates snapshots, templates, and LLM output; loose validation there means corrupt rooms.
  - **P-06-6 (SCHEMA FREEZE)** Approval of F06 freezes `schemaVersion: 1`. Any later change to `CanvasDocument` requires bumping `CANVAS_SCHEMA_VERSION`, adding `migrateV{n}ToV{n+1}` in `lib/canvas/schema.ts`, a fixture in `tests/fixtures/canvas/v{n}-*.json`, and a decision-log entry.

## Reference material

- `context/architecture-context.md` "Canvas architecture"; `context/domain-model.md` "Canvas schema v1"; `context/ui-context.md` "Canvas visuals", "Layout patterns" (flush canvas); `context/data-ownership.md` rule 1.
- Research `research/react-flow.md` §1 (version, CSS ordering, SSR width/height), §8 (viewport/fitView/Background/MiniMap defaults), §12 (runtime fields to strip), §13 (memoisation rules) — checked 2026-10-22; `research/liveblocks.md` §1 (hook options, synced vs local fields) — checked 2026-10-22.
- Reference prompt `No_touch_ai/…/feature-specs/11-base-canvas.md` (intent: suspense hook, empty initial state, loose connections, MiniMap, dots). Its unconditional `fitView` is superseded by P-06-2.
- Reference bugs that become ACs here: canvas "floating card" (`current-issues-liveblocks-canvas.md`), auto-zoom on first drop (`current-issues-workspace-implementation.md` §5). Cross-refs only: deletions bypassing Liveblocks → F10; drop position offset → F07.
- Risk R-01 (same-key LWW) is exercised by the concurrency TCs here; R-05 answers from F05 T-001 are prerequisites.
