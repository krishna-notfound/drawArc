# F07 — Shapes and node creation

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F06 (base collaborative canvas: `useLiveblocksFlow` output, `ReactFlowProvider`, role prop, `types/canvas.ts`) |
| Depended on by | F08 (node editing), F09 (edges), F10 (ergonomics), F14 (templates), F17 (agent writes the same node shape), F21 (future freehand node type) |
| Product requirements | PRD-021; contributes to PRD-012 (viewer read-only), NFR-004, NFR-006 |
| Status | see status.md |

## Purpose

F07 turns the empty collaborative canvas delivered by F06 into something a user can populate. It adds the bottom-centre shape palette, the drag-from-palette interaction with a ghost preview, the drop maths that puts a node exactly under the cursor at any pan/zoom, the six shape renderers with their four connection handles, and the single write path by which a new node enters Liveblocks Storage. It sits directly after F06 because every later canvas feature (editing, edges, shortcuts, templates, the AI agent) manipulates nodes that only this feature can create, and because the node component defined here is the host for F08's resizer/editor and F09's handles.

## Problem statement and goals

- Problem: the reference implementation (`No_touch_ai/.../current-issues-workspace-implementation.md` §3–§5 and `current-issues-liveblocks-canvas.md` "DRAG AND DROP ISSUES") shipped with four real defects — nodes landed below the cursor, the first drop auto-zoomed the viewport, only the top handle accepted connections, and a wrapper element swallowed the drag events so dropping did nothing at all. drawArc must make these impossible by construction and verifiable by test.
- G-1: a node dropped at any zoom in [0.5, 2] and any pan has its centre within 1 px of the pointer-up position (L1 maths + L3).
- G-2: the viewport transform is byte-identical before and after a drop, including the first drop on an empty canvas.
- G-3: every one of the four handles on every shape accepts a connection start and a connection end (verified by F09's tests, enabled here).
- G-4: a node created by user A is visible to user B within 1 s with the same id, position, size, shape and colour.
- G-5: shape placement is possible without a pointer (keyboard) — NFR-006.

## Scope

In scope:
- `components/canvas/shape-palette.tsx`: bottom-centre pill, six icon buttons, tooltips, keyboard placement.
- `hooks/useShapeDrag.ts`: pointer-events drag state, pointer capture, ghost coordinates, drop resolution via `document.elementFromPoint`.
- `components/canvas/shape-drag-ghost.tsx`: fixed-position ghost preview, centred on the pointer, sized `DEFAULT_SIZES[shape] × zoom`, `pointer-events: none`.
- `lib/canvas/drop-position.ts`: pure function `centredDropPosition(flowPoint, size)`; `lib/canvas/ids.ts`: `newNodeId(shape)` / `newEdgeId()` (created here if F06 did not).
- `hooks/useCanvasMutations.ts`: thin typed wrapper over the F06 hook handlers (`addNode`, `replaceNode`, `updateNodeData`, `addEdge`, `replaceEdge`, `updateEdgeData`) — the **only** client write path for F07–F14.
- `components/canvas/nodes/canvas-node.tsx` (memoised node component, `nodeTypes` constant), `components/canvas/nodes/shape-renderer.tsx` (CSS and SVG shapes), `components/canvas/nodes/node-handles.tsx`.
- Role gating of the palette and node creation.

Out of scope / non-goals:
- Resize, label editing, colour toolbar → F08. Handle *styling during connection* is here; edge creation/validation → F09.
- Delete, duplicate, context menu, shortcuts → F10. Templates → F14.
- Snap-to-grid, node rotation, grouping/sub-flows, custom shapes, freehand → never (project-overview non-goals) / F21.
- `<ReactFlow>` interaction props (`connectionMode`, `deleteKeyCode={null}`, `fitView` on mount, `panOnDrag`) → F06 owns them; F07 only asserts them.

## User stories

- US-1: As an editor, I want to drag a shape from the palette and see a preview under my cursor, so that I know exactly where the node will land.
- US-2: As an editor, I want the dropped node centred under my cursor at the current zoom, so that I do not have to reposition every node after dropping it.
- US-3: As an editor, I want the viewport to stay put when I drop a node, so that I keep my place in a large diagram.
- US-4: As a keyboard user, I want to focus a palette button and press Enter to place that shape, so that I can build diagrams without a mouse.
- US-5: As a collaborator, I want to see nodes other people add immediately and in the same place, so that we are looking at the same diagram.
- US-6: As a viewer, I must not see the palette nor be able to create nodes, and if I try through devtools the room must reject the write.
- US-7: As an editor, I want to start a connection from any side of a node (enabled here, exercised in F09).

## Key decisions referenced

- D-012 (Liveblocks Storage via `@liveblocks/react-flow`), D-013 (per-client history), D-020 (canvas interaction defaults; reference bugs become ACs), D-023 (pins).
- **PROPOSED D-07a — Node creation uses `onNodesChange([{ type: 'add', item }])` from `useLiveblocksFlow`, not `useMutation` on Storage.** Rationale: `data-ownership.md` names the hook handlers as the client write path; `domain-model.md` marks the `flow` Storage layout as package-managed ("do not hand-edit"); the internal LiveMap layout is undocumented (liveblocks.md §1) and may change on upgrade. The hook's acceptance of `add`/`replace` changes is UNVERIFIED (see 02-design) and is confirmed by spike T-001 before anything else is built.
- **PROPOSED D-07b — Pointer-events drag, not HTML5 Drag and Drop.** The official React Flow example moved to pointer events and states the HTML5 variant "has poor touch support" (react-flow.md §10, S62); pointer capture also removes the reference bug where an ancestor intercepted `dragover`/`drop`.
- **PROPOSED D-07c — The ghost is anchored at its centre to the pointer, so the grab offset is zero by construction.** The reference bug came from an HTML5 drag image that preserved the grab offset while the drop used the element's top-left. We make the preview and the drop maths share one anchor: the pointer position.
- **PROPOSED D-07d — Click or Enter/Space on a palette button places the shape at the viewport centre.** Serves keyboard users (NFR-006) and touch users who tap instead of drag.
- **PROPOSED D-07e — The palette is visible at every viewport width ≥ 480 px** (compact spacing < 768 px); it is never hidden on narrow screens because touch drag works with pointer events. Below 480 px the workspace is unsupported (mobile-native is a non-goal).
- **PROPOSED D-07f — A newly created node is selected locally** (`select` change, local-only) so F08's toolbar and label editor are one keystroke away.

## Reference material

- `context/architecture-context.md` "Canvas architecture" (drop pattern, no post-drop fitView, handles), `context/ui-context.md` "Canvas visuals" (default sizes, handle style, border rules), `context/domain-model.md` canvas schema v1, `context/code-standards.md` React/client-state rules.
- Research: `research/react-flow.md` §2 (custom nodes, `NodeProps`, handles, `ConnectionMode.Loose`, `display:none` pitfall), §8 (`screenToFlowPosition`, `fitView` prop initial-only), §10 (pointer-events DnD), §13 (memoisation) — all checked 2026-10-22. `research/liveblocks.md` §1 (synced vs local-only fields, hook return value), §2 (`useMutation` batching), §3 (undo) — checked 2026-10-22.
- Reference prompts (intent only): `No_touch_ai/.../feature-specs/12-shape-panel.md`, `13-node-shape.md`.
- Reference bugs that become ACs: `current-issues-workspace-implementation.md` §3 (top-handle-only), §4 (drop offset), §5 (auto-zoom on first drop); `current-issues-liveblocks-canvas.md` "DRAG AND DROP ISSUES" (parent intercepting events).
