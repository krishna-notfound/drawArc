# F09 — Edges and connections

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F07 (nodes with four handles, `useCanvasMutations`, `newEdgeId`), F06 (`connectionMode="loose"`, hook `onConnect`/`onEdgesChange`/`onDelete`, role prop) |
| Depended on by | F10 (Delete key removes selected edges via `onDelete`; edge context menu), F14 (template edges use the same edge shape), F17 (agent `addEdge`) |
| Product requirements | PRD-025 (connect any handle to any handle, reconnect, delete), PRD-026 (smooth-step, arrowhead, hover/selection highlight, inline label); contributes to PRD-012, NFR-004, NFR-006 |
| Status | see status.md |

## Purpose

F09 gives the diagram its relationships. It defines the single custom edge type `canvasEdge`, how a connection gesture becomes a persisted edge with a drawArc id, which connections are rejected (self-loops, duplicates), how an edge end is moved to another handle, how an edge is labelled inline, and how edges disappear atomically with their nodes. It comes after F07 because it needs the four handles and the mutation wrapper, and before F10 because the Delete key handler must call the edge-side deletion defined here.

## Problem statement and goals

- Problem: the reference implementation connected only from the top handle (`current-issues-workspace-implementation.md` §3) and never specified edge identity, validation, reconnection semantics, or what happens to edges when a source node is deleted by someone else. The hook's own `onConnect` is documented as "pass straight into `<ReactFlow>`" (liveblocks.md §1) but **does not document the id or `type` it assigns**, which conflicts with the domain-model rule that edge ids are `e_${ulid}` and type is `canvasEdge`.
- G-1: every (sourceHandle, targetHandle) pair across two distinct nodes — 16 combinations — produces exactly one edge with the correct handle ids (fixes the reference bug by test).
- G-2: self-loops and exact duplicate (source, sourceHandle, target, targetHandle) connections are rejected before any Storage write.
- G-3: an edge created by A renders for B within 1 s with identical id, endpoints, and style.
- G-4: deleting a node removes its edges in the same Liveblocks step on every client (one undo entry).
- G-5: an edge label can be set without a pointer leaving the canvas, and edges remain easy to click (20 px hit area) without thick strokes.

## Scope

In scope:
- `components/canvas/edges/canvas-edge.tsx`: `getSmoothStepPath` + `<BaseEdge>`, `interactionWidth={20}`, rest/hover/selected styles, arrowhead marker, inline label via `<EdgeLabelRenderer>`, `edgeTypes` constant.
- `defaultEdgeOptions` and `edgeTypes` wired into the F06 `<ReactFlow>`.
- `onConnect` wrapper: validation → edge object `{ id: newEdgeId(), source, target, sourceHandle, targetHandle, type: 'canvasEdge', data: {} }` → `useCanvasMutations().addEdge`.
- `isValidConnection` at the `<ReactFlow>` level (self-loop and duplicate rejection).
- Reconnection: `onReconnect`, `onReconnectStart`, `onReconnectEnd`, `edgesReconnectable`; drop-off deletes the edge.
- Edge label editing: double-click → growing input, Enter/Esc/blur, pill badge, faint hint on a selected unlabelled edge, max 100 characters.
- Edge-side deletion contract for F10: `onDelete({ nodes: [], edges: selectedEdges })`.
- Viewer read-only.

Out of scope / non-goals:
- Keyboard handler for Delete, context menu → F10. Edge types other than smooth-step, bezier curvature controls, editable control points (Pro example) → never in M1. Edge direction flip, bidirectional arrows → not in M1 (would need schema data; revisit in schema v2). Edge-to-edge connections, floating edges without handles → never.

## User stories

- US-1: As an editor, I want to drag from any side of a node to any side of another node to create an arrow, so the diagram reads the way I think.
- US-2: As an editor, I want a connection dropped on nothing to do nothing, and a duplicate connection to be refused, so my diagram stays clean.
- US-3: As an editor, I want to grab an edge end and move it to another handle, or drop it in space to delete the edge.
- US-4: As an editor, I want to double-click an edge and type a short label ("HTTPS", "events") shown as a small badge.
- US-5: As an editor, I want to click an edge easily and see it highlighted, then delete it with the Delete key (F10).
- US-6: As a collaborator, I want edges to appear/disappear for me exactly as they do for their author, including when a node is deleted.
- US-7: As a viewer, I must not be able to connect, reconnect, relabel or delete edges, and no handles or reconnect affordances should invite me to try.

## Key decisions referenced

- D-012, D-013, D-020 (loose connections), F07 D-07a (write path), domain-model id rule.
- **PROPOSED D-09a — drawArc's own `onConnect` builds the edge and emits it through `onEdgesChange([{ type: 'add', item }])`; the hook's `onConnect` is not used.** Rationale: the hook's `onConnect` id/type behaviour is UNVERIFIED (liveblocks.md §1 lists it but not what it sets); the domain model requires `e_${ulid}` and `type: 'canvasEdge'`; `data: {}` must exist for label sync. Spike T-001 confirms the hook persists `add` edge changes (same mechanism as F07's nodes).
- **PROPOSED D-09b — Dropping a reconnected edge end on empty space deletes the edge** (Excalidraw/Figma behaviour, matches the React Flow reconnect example's intent). Reconnecting to the same handle pair is a no-op (no write, no undo entry).
- **PROPOSED D-09c — Arrowhead via `defaultEdgeOptions.markerEnd = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: EDGE_STROKE }`**, with `EDGE_STROKE = '#f8fafc'` exported from `types/canvas.ts` (the one file allowed to hold hex literals besides `globals.css`). Edge objects in Storage carry **no** `markerEnd`; the marker is a render concern. If T-001 shows `defaultEdgeOptions` is not applied to controlled edges at render time, fallback: the `CanvasEdge` component renders a shared `<marker id="canvas-arrow">` in a `<defs>` and passes `markerEnd="url(#canvas-arrow)"` to `<BaseEdge>`.
- **PROPOSED D-09d — Duplicate = same (source, sourceHandle, target, targetHandle).** The reverse direction (B→A) and the same nodes via different handles are allowed, because arrows are directional and users draw parallel relationships on purpose.
- **PROPOSED D-09e — Edge label max 100 characters, single line** (no newlines; Enter commits), stored in `data.label`; empty string removes the key (`data: {}`) so unlabelled edges stay minimal.

## Reference material

- `context/ui-context.md` "Canvas visuals — Edges" (stroke `#f8fafc` 60 % → 100 %, rounded caps, closed arrowhead, `interactionWidth` 20, pill badge, faint hint), "Handles"; `context/domain-model.md` (edge ids, required handles on persisted edges); `context/architecture-context.md` canvas section.
- Research `research/react-flow.md` §2 (handles, `isValidConnection` recommended at `<ReactFlow>` level, `ConnectionMode.Loose`), §3 (custom edges, `getSmoothStepPath` → `[path, labelX, labelY]`, `BaseEdge` `interactionWidth` default 20, `EdgeLabelRenderer` no pointer events by default, `MarkerType.ArrowClosed`, reconnection semantics `onReconnect`/`reconnectEdge`/`edgesReconnectable`/`onReconnectStart/End`), §14 (edges focusable, `ariaLabel`) — checked 2026-10-22. `research/liveblocks.md` §1 (hook returns `onConnect`/`onDelete`; "`onDelete` removes a node and its edges atomically so they undo together"; edge endpoints synced; `selected` local-only), §3 — checked 2026-10-22.
- Reference prompt (intent only): `No_touch_ai/.../16-edge-behavior.md`. Reference bug: `current-issues-workspace-implementation.md` §3 (top-handle-only connections).
