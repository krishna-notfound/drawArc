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

---

## v2 — richer node editing (2026-10-28)

> Increment to the shipped v1 (PR #13). v1 requirements FR-001–FR-014 are unchanged; v2 continues the numbering (FR-015+, EC-014+, AC-025+, T-008+, TC-029+). Sources: `docs/research/excalidraw/00-summary.md` rows R-007, R-008, R-024, R-027, R-028, R-029, R-031, R-048 (all "Upgrade F08"); decisions D-052, D-053, D-057, D-063.

| Field | Value |
|---|---|
| Depends on (v2) | **F22** (schema v2 migration, D-057 — merged first; F08 v2 only reads/writes fields F22 reserves), F10 FR-008 (`selectionKeyCode="Shift"`), F13 (persisted `height` is the rendered height) |
| Depended on by (v2) | F22 text/sticky nodes reuse the text options and the properties toolbar; F19 PNG export renders borders/text options; F17 agent nodes may set them |
| Product requirements | PRD-022, PRD-023, PRD-024 (extended); NFR-006 |

### Purpose (v2)
Daily-feel upgrades from the Excalidraw research: Shift keeps the aspect ratio while resizing, a node grows to fit its label instead of clipping at five lines, per-node text options (size, alignment, bold), border style and width, custom hex colours with a contrast guard, and one compact properties toolbar replacing the colour-only toolbar. Everything still writes through `useCanvasMutations`; every user action remains one undo step.

### Goals (v2)
- G-6: Shift during a resize drag keeps the drag-start aspect ratio for every shape; Shift outside a resize drag still box-selects (F10 FR-008).
- G-7: a label commit, text-option change or resize never leaves text clipped while the node is under the height cap; the fitted height lands in the same undo step as its cause.
- G-8: every node colour, palette id or hex, renders its label at ≥ 4.5:1 (NFR-006).
- G-9: a property change on N selected nodes is one write and one undo step; a multi-node drag is one undo step.

### Scope (v2)
In: FR-015–FR-027 (01-requirements). Out / non-goals: fonts other than Geist (never, 01§X8); rich text or per-run formatting (never); rotation (P3, 01§R2 — later increment, needs a schema `rotation` field); sketchy style (P3, D-052); eyedropper (R-062, browser `EyeDropper` API UNVERIFIED — skipped); union-bounding-box group resize (R-024/01§S7, P3 — v2 only guarantees batched mutations); copy/paste styles (R-030 → F10 upgrade); font-size shortcuts Ctrl+Shift+< / > (→ F10 upgrade; v2 defines the toolbar only); remembered style for new nodes (03§F-40, P3).

### User stories (v2)
- US-9: As an editor I hold Shift while dragging a corner so a hexagon keeps its proportions.
- US-10: As an editor I type a long label and the node grows downward so nothing is cut off; when I make it narrower it grows taller.
- US-11: As an editor I make a title node large and bold, left-align a list node, and dash the border of an "optional" component.
- US-12: As an editor I paste `#0f766e` from my brand sheet and the label stays legible without my choosing a text colour.
- US-13: As an editor with six nodes selected I see "—" where their values differ and one click sets all six.
- US-14 (failure): As a viewer I see borders, text options and custom colours rendered, but never the toolbar, and my writes are rejected.

### Decisions referenced / proposed (v2)
- D-053 (Esc cancels — unchanged), D-057 (schema v2 owned by F22), D-063 (hex + contrast guard), D-013 (one undo step per gesture), D-08b (one toolbar for the selection — extended).
- **PROPOSED D-08e — Auto-grow writes the fitted height in the same change (or paused history span) as its cause** — label commit, text-option change, resize end — measured in the DOM, never per keystroke; a node never auto-shrinks; the resizer's `minHeight` equals the content height so text cannot be clipped by hand. Cap `AUTO_GROW_MAX_HEIGHT = 480`.
- **PROPOSED D-08f — Shift (keep aspect) and Alt (from centre, P3) are read from the resize drag's `event.sourceEvent`**, not from a window key listener, so they only exist while a handle is active (01§T4 conflict with box select resolved).
- **PROPOSED D-08g — Derived text colour for a hex fill is pure white or pure black chosen by WCAG relative luminance** (always ≥ 4.58:1, proof in 02-design); palette ids stay preferred — a hex equal to a palette fill is stored as that id. *Resolved at validation (2026-10-28): adopted as the shared `lib/canvas/color.ts` behaviour; F22 FR-004 and `context/domain-model.md` aligned (O-v2-3).*

### Reference material (v2)
`docs/research/excalidraw/01-selection-tools-text.md` §T4, §T5, §R4, §S7, §X6, §X7, §X9, §X10; `03-editing-productivity.md` §2.5 (F-31, F-32, F-33, F-36), §2.6 (F-41, F-43, F-44); `00-summary.md` §C1 (reserved v2 fields). React Flow 12.12.0 types read from `node_modules/@xyflow/react` and `@xyflow/system@0.0.83` on 2026-10-28 (02-design "Verified library facts (v2)").
