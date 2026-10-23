# F21 — Freehand Strokes

| Field | Value |
|---|---|
| Milestone | Future |
| Depends on | F07 (shapes-and-node-creation: palette, node types, drop pipeline), F06 (canvas schema v1 frozen), F13 (schema migrations), F08 (resize) |
| Depended on by | — |
| Product requirements | — (freehand drawing is a recorded non-goal in project-overview.md; D-008 reserves the roadmap path; a decision-log entry is required before specification) |
| Status | see status.md |

## Purpose

Let a user draw a freehand stroke on the canvas that is stored, synced, undone, selected, moved, and resized exactly like any other node. It sits after F07 because D-008 fixes the only viable design: React Flow has no non-node canvas primitive, so a stroke must be a node with a new shape, and F07 owns the shape registry, palette, and node-creation pipeline this feature extends.

## Problem statement and goals

- Problem: users annotating an architecture (circling a cluster, drawing an arrow to a note, sketching a boundary) have no way to do it; drawArc is deliberately node-and-edge only. The roadmap path (D-008) is "stroke-as-node", which keeps collaboration, persistence, and undo unchanged.
- G-1: a user selects a draw tool, drags on the canvas, and on pointer-up a `freehand` node appears for every participant within 1 s, rendered identically on all clients.
- G-2: freehand nodes participate in selection, move, resize, delete, undo/redo, autosave, and templates-replace with no special cases outside the node component and the draw overlay.
- G-3: a canvas document with 200 strokes of up to 2,000 points each stays under the 4 MB snapshot cap and the 10 MB Liveblocks room cap, and remains interactive (NFR-004 bar).
- G-4: canvas schema v1 documents load unchanged after the schema bump (migration is a pure addition).

## Scope

In scope:
- Canvas schema **v2**: `NODE_SHAPES` gains `'freehand'`; node data for that shape is `{ shape: 'freehand', label: '', color: NodeColorId, points: [x, y, pressure][] (≤ 2,000, relative to the node's top-left in flow units), strokeWidth: number (2–16) }`; `width`/`height` = stroke bounding box + 2 × padding (8 px). `migrateV1ToV2(doc)` sets `schemaVersion: 2` and changes nothing else; `CanvasDocumentSchema` becomes a discriminated union on `shape` so existing shapes reject `points`.
- Draw tool: a pen icon in the bottom palette (F07) toggles "draw" mode; `D` shortcut (F10 conventions, ignored while typing); Esc exits.
- Pointer overlay: a `<ViewportPortal>` child (https://reactflow.dev/api-reference/components/viewport-portal checked 2026-10-22) covering the viewport while draw mode is active; captures `pointerdown/move/up`, converts with `screenToFlowPosition`, renders the in-progress path locally (not synced), and on pointer-up normalises points to the bbox and commits one node through the same `onNodesChange` add path F07 uses — so it syncs via `useLiveblocksFlow` and lands in the drawer's undo stack like a drop.
- Rendering: `components/canvas/nodes/FreehandNode.tsx` renders an SVG path from `getStroke(points, { size: strokeWidth, thinning, smoothing, simulatePressure })` scaled by `width / bboxWidth`; resize (F08 `NodeResizer`) scales the points' render transform rather than rewriting points; stroke colour uses the palette pair's `text` colour; selection shows the usual brand border on the bbox.
- Freehand nodes have **no handles** (PROPOSED): they cannot be edge endpoints; the node registers no `<Handle>`s and `onConnect` validation rejects them.
- Caps: ≤ 2,000 points per stroke (overlay downsamples beyond that), ≤ 200 freehand nodes per document (tool disabled with a tooltip at the cap); `NODE_SHAPES` validation rejects `freehand` in F14 templates and in the F17 `DesignPlan` validator (agent never emits strokes).
- `perfect-freehand` (MIT) added as a dependency — version **UNVERIFIED** on 2026-10-22; pin on verification.

Out of scope / non-goals:
- Rotation — never (React Flow `Node` has no rotation field; react-flow.md §15).
- Eraser tool, lasso selection, text-on-stroke, stroke editing (adding points to an existing stroke) — later features if ever.
- Pressure-sensitive rendering beyond what `perfect-freehand` simulates — not in the first version.
- A whiteboard mode (free text, unbound arrows) — never; tldraw/Excalidraw serve that (D-008).

## User stories

- US-1: As an editor, I want to draw a freehand stroke on the canvas so that I can circle or annotate part of the architecture.
- US-2: As a collaborator, I want to see strokes others draw in real time and move/resize/delete them like nodes.
- US-3: As an editor, I want undo to remove my last stroke so that a slip is cheap.
- US-4: As a user with an old snapshot, I want it to open unchanged after the schema bump.
- US-5 (abuse): As a viewer I must not be able to draw: the tool is hidden and any stroke write is rejected by the read-only Liveblocks token.
- US-6 (abuse): As an editor I must not be able to blow the room past its storage cap with strokes: the point and stroke caps are enforced client-side and the server rejects snapshots that exceed them (422).
- US-7 (abuse): The AI agent (F17) or a template (F14) must never produce a `freehand` node; the shared validator rejects it.

## Key design idea

**A stroke is a node.** Everything that already works for nodes — Storage sync, per-client undo, selection, resize, autosave, templates-replace, KICK, snapshots — works for strokes with zero new infrastructure, because the only new things are (1) a shape value, (2) a node component that draws an SVG path, and (3) a pointer overlay that produces a node. This is the exact pattern React Flow's whiteboard guide describes (https://reactflow.dev/learn/advanced-use/whiteboard checked 2026-10-22; the official Freehand Draw example is Pro — https://reactflow.dev/examples/whiteboard/freehand-draw checked 2026-10-22 — and is not used; the MIT `perfect-freehand` library it depends on is).

Trade-offs accepted (react-flow.md §15, checked 2026-10-22):
- Every stroke is a DOM node; hundreds of strokes cost like hundreds of nodes (hence the 200 cap and the NFR-004 check).
- Hit-testing and selection use the axis-aligned bounding box, not the stroke path; a long diagonal stroke selects over empty space.
- No rotation; no binding of edges to strokes (no handles).
- Storage: 2,000 points × 3 numbers ≈ 50 KB JSON per stroke; 200 strokes ≈ 10 MB worst case — therefore the realistic default cap is 1,000 points/stroke unless simplification brings the average well under; the spec must measure the F13 fixture and set the cap from data.

## Key decisions referenced

- D-008 (APPROVED: freehand out of MVP; roadmap as stroke-as-node; `NodeShape` may gain `'freehand'` in a future schema version).
- D-012 / D-013 (Storage sync via `@liveblocks/react-flow`; per-client undo) — strokes inherit both.
- D-020 (no `fitView` after creation) — applies to stroke commit.
- Domain-model.md rule: any shape change bumps `schemaVersion` and adds `migrateV{n}ToV{n+1}`.
- PROPOSED D-21a — "Freehand nodes have no handles." Rationale: avoids edge-anchor ambiguity on a path; Excalidraw-style bound arrows are out of scope.
- PROPOSED D-21b — "Stroke caps: ≤ 2,000 points (likely 1,000 after measurement) and ≤ 200 strokes per document." Rationale: 10 MB room cap and 4 MB snapshot cap.
- PROPOSED D-21c — "Resize scales the render transform, not the stored points." Rationale: lossless, cheap, undoable as a dimension change.

## Preconditions before this feature is specified

1. F06 is `verified` and canvas schema v1 is frozen and shipped; F13's migration pipeline is `verified` with a v1 fixture, so v2 can be added as a real migration with a regression test.
2. F07 and F08 are `verified` (palette, node-creation path, `NodeResizer` behaviour) so the draw overlay and resize scaling reuse proven code.
3. The owner approves a decision expanding D-008 from "roadmap" to "scheduled" and records it; the templates (F14) and agent (F17) validators are confirmed to reject unknown shapes today.
4. `perfect-freehand` version, API (`getStroke` options), and React 19 compatibility verified against its repository with URL and date.
5. Measurement task: JSON size and drag frame time for 200 strokes × N points on the F13 500-node fixture, to set D-21b's numbers from data.

## Reference material

- `context/decision-log.md` D-008; `context/domain-model.md` canvas schema v1 and migration rule; `context/ui-context.md` shapes, handles, palette; `context/architecture-context.md` canvas architecture.
- Research react-flow.md §15 (whiteboard guide, freehand/lasso/eraser examples, trade-offs) — https://reactflow.dev/learn/advanced-use/whiteboard checked 2026-10-22; https://reactflow.dev/examples/whiteboard/freehand-draw checked 2026-10-22 (Pro); https://reactflow.dev/examples/whiteboard/lasso-selection checked 2026-10-22 (not Pro); `<ViewportPortal>` — https://reactflow.dev/api-reference/components/viewport-portal checked 2026-10-22; `screenToFlowPosition` — https://reactflow.dev/api-reference/types/react-flow-instance checked 2026-10-22; `Node` has no rotation field — https://reactflow.dev/api-reference/types/node checked 2026-10-22.
- `perfect-freehand`: licence MIT per the whiteboard guide's dependency listing; version and API UNVERIFIED on 2026-10-22.
- Reference prompts (`No_touch_ai/`): none cover freehand drawing.
