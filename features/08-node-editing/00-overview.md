# F08 — Node editing

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F07 (node component, `useCanvasMutations`, `ShapeRenderer`), F06 (hook pipeline, role prop) |
| Depended on by | F10 (shortcut handler must respect the open editor; context menu), F14 (import while editing), F17 (agent-created nodes are edited with the same tools) |
| Product requirements | PRD-022 (resize with minimum size, stored dimensions), PRD-023 (inline label editing), PRD-024 (colour toolbar); contributes to PRD-012, NFR-004, NFR-006 |
| Status | see status.md |

## Purpose

F08 makes a node meaningful: it can be resized to fit its content, labelled with text, and recoloured from the 8-pair palette. Everything F08 writes goes through the F07 `useCanvasMutations` wrapper over the F06 `useLiveblocksFlow` handlers, so a resize, a label commit, and a colour change are each one Liveblocks change visible to every participant and one entry in the author's undo stack. It comes after F07 because it extends the node component defined there and before F09/F10 because edges and keyboard shortcuts must coexist with an open text editor.

## Problem statement and goals

- Problem: the reference editor (prompts 14/15) specified resize, textarea editing and a colour toolbar but left the collaborative semantics undefined: which dimensions are persisted, what happens when a node is deleted mid-edit, how concurrent label edits resolve, and how a resize appears in undo. drawArc must state and test those semantics (D-013, D-014).
- G-1: a resize updates the node's persisted `width`/`height` and is seen by other users at the same size within 1 s.
- G-2: an inline edit never triggers a canvas shortcut, drag, pan, or deletion (PRD-023, reference bug: Backspace deleting the node while typing).
- G-3: a drag or resize is exactly one undo step; a label commit is one step; a colour change is one step.
- G-4: a node deleted by another user while being edited closes the editor without an error or an orphan write.
- G-5: all editing affordances are absent for viewers and keyboard-operable for editors (NFR-006).

## Scope

In scope:
- `<NodeResizer>` on selected nodes (min 48 × 32, `keepAspectRatio` for circle), styled per ui-context, dimensions persisted through the hook pipeline.
- Inline label editing (`components/canvas/nodes/node-label-editor.tsx`): double-click → centred textarea overlay, placeholder when empty, Enter commits / Shift+Enter newline / Esc cancels / blur commits, `nodrag nowheel nopan`, key events stopped from reaching the canvas, max 200 characters.
- Floating colour toolbar (`components/canvas/node-color-toolbar.tsx`) via `<NodeToolbar>` with the 8 swatches, keyboard operable, multi-select applies to all selected nodes.
- Label placeholder rendering at rest ("Double-click to label", faint).
- Viewer read-only behaviour for all three.

Out of scope / non-goals:
- Rich text, fonts, alignment options, rotation → never (non-goals).
- Edge labels → F09. Delete/duplicate/shortcuts/context menu → F10.
- Character-level merge of concurrent label edits (`LiveText`) → D-014 accepts LWW for M1.
- Auto-sizing nodes to their text → not in M1 (fixed `width`/`height` is required for persistence/SSR, domain-model).

## User stories

- US-1: As an editor, I want to drag a corner of a selected node to resize it so that long labels fit.
- US-2: As an editor, I want to double-click a node and type its label, and have Enter save it, so labelling is fast.
- US-3: As an editor, I want Backspace/Delete/arrow keys while typing to edit text, never to delete or move the node.
- US-4: As an editor, I want to click a swatch above the selected node(s) to recolour them so the diagram's legend is readable.
- US-5: As a keyboard user, I want to open the editor, change colour and resize without a pointer (Enter to edit; arrow keys in the swatch group).
- US-6: As a collaborator, I want to see others' resizes, labels and colours as they commit them.
- US-7: As a viewer, I must not see resize handles, the colour toolbar, or be able to open the editor.
- US-8 (failure): As an editor whose node was just deleted by a teammate while I was typing, I want the editor to simply close, with no error and no resurrected node.

## Key decisions referenced

- D-013 (per-client history; drags/resizes one step), D-014 (label LWW per key), D-020, F07 D-07a (write path).
- **PROPOSED D-08a — Label edits are buffered locally and written once on commit (Enter/blur), not per keystroke.** Rationale: one undo step per edit, Esc cancel is trivially "discard draft", and the window for D-014's LWW clobbering shrinks from "every keystroke" to "the commit instant". Trade-off: collaborators see the final label only, not live typing. The owner should confirm because D-014's wording ("per keystroke batch") suggests the live alternative; the live alternative is documented as the fallback in 02-design.
- **PROPOSED D-08b — One colour toolbar for the whole selection.** `<NodeToolbar nodeId={selectedIds[]}>` renders a single toolbar above the selection bounds; a swatch applies to every selected node in one batched mutation (one undo step). Rationale: React Flow hides per-node toolbars for multi-selections anyway (react-flow.md §6), and recolouring a group is a common legend operation.
- **PROPOSED D-08c — Resize keeps the top-left anchored except when the top/left handle is dragged** (React Flow default: emits a position change then). Circle keeps a 1:1 aspect ratio (`keepAspectRatio`); other shapes are free.
- **PROPOSED D-08d — Label max length 200 characters, hard-limited in the textarea (`maxLength`) and trimmed of trailing whitespace on commit; newlines are preserved (max 5 lines rendered, overflow hidden).**

## Reference material

- `context/ui-context.md` "Canvas visuals" (min size 48 × 32, selected border + resize handles, palette), "Interaction conventions" (Edit label row), "Accessibility expectations".
- `context/architecture-context.md` "Canvas architecture" (synced vs local fields, D-014), `context/code-standards.md` (keyboard handlers ignore inputs; data updates create new objects).
- Research: `research/react-flow.md` §5 (NodeResizer props; **how size is stored**: `NodeDimensionChange { dimensions, resizing, setAttributes }` → `width`/`height` set on the node, S44/S38), §6 (NodeToolbar `nodeId: string | string[]`, hidden for multi-select unless `isVisible`, does not scale), §7 (no built-in text editor; `nodrag`/`nowheel`/`nopan`; built-in Backspace/arrow keys — editors must stop propagation), §9 — checked 2026-10-22. `research/liveblocks.md` §1 (width/height synced; "Drags and resizes collapse into a single undo entry"; `updateNode` no-op if id missing), §2 (per-key LWW), §3 (undo per client, no rebase) — checked 2026-10-22.
- Reference prompts (intent only): `No_touch_ai/.../14-node-editing.md`, `15-node-color-toolbar.md`.
- Reference bug context: `current-issues-workspace-implementation.md` §2 (deletion must bypass `deleteKeyCode`; typing must never delete).
