# F10 — Canvas ergonomics and keyboard

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F08 (label editor must be respected by the key handler; node mutations), F09 (edge deletion contract, edge context menu), F07 (`useCanvasMutations`, ids), F06 (`deleteKeyCode={null}`, selection props, `ReactFlowProvider`) |
| Depended on by | F14 (uses `fitView` conventions and the control bar's undo semantics), F15 (a11y smoke covers the cheat-sheet), F16/F17 (shortcuts must not fire inside the AI sidebar inputs) |
| Product requirements | PRD-027 (Delete/Backspace, per-client undo/redo, documented shortcuts), PRD-022 (selection semantics); contributes to PRD-012, NFR-006 |
| Status | see status.md |

## Purpose

F10 is where the canvas becomes comfortable: a bottom-left control bar for zoom and history, one window-level keyboard handler for every shortcut, confirmed selection semantics, a right-click context menu, and a `?` cheat-sheet so the shortcuts are discoverable (PRD-027 "documented in the UI"). It is placed after F08 and F09 because deletion must route through the collaborative `onDelete` for both nodes and edges, and the key handler must stay out of the way of the inline editors those features introduced.

## Problem statement and goals

- Problem: the reference editor (`current-issues-workspace-implementation.md` §2) could not delete anything: React Flow's `deleteKeyCode` was either on (bypassing the collaborative pipeline and deleting nodes while users typed) or off with no replacement. Zoom/undo had buttons but no keyboard path, and nothing told users which shortcuts existed.
- G-1: Delete/Backspace removes the selection through `onDelete` on every client in one step, and never fires while typing or while a dialog is open (reference bug).
- G-2: every shortcut in `ui-context.md` "Interaction conventions" works exactly as written and is listed in the cheat-sheet with identical copy.
- G-3: undo/redo are per-client (D-013); the UI shows a disabled state when there is nothing to undo/redo; the no-rebase outcome after a remote change is documented and tested.
- G-4: a right-click menu offers the minimal set (duplicate / delete / select all / fit view) and is fully keyboard operable, flipping at viewport edges.
- G-5: viewers get zoom/fit and the cheat-sheet's navigation rows only; every mutating shortcut is a no-op for them.

## Scope

In scope:
- `components/canvas/canvas-controls.tsx`: bottom-left pill — zoom out / fit view / zoom in · divider · undo / redo, disabled states, aria-labels, tooltips with shortcut hints.
- `hooks/useKeyboardShortcuts.ts`: window `keydown` listener; ignore rules; full shortcut map; duplicate selection (`⌘/Ctrl+D`); select all; clear selection; `?` cheat-sheet.
- Selection configuration confirmation (props set by F06; F10 asserts and documents): `selectionOnDrag`, `selectionMode="partial"`, `selectionKeyCode="Shift"`, `multiSelectionKeyCode` default (Meta/Control), `panOnDrag={[1, 2]}`, Space+drag pan.
- `components/canvas/canvas-context-menu.tsx`: node/edge/pane menus via `onNodeContextMenu`/`onEdgeContextMenu`/`onPaneContextMenu`.
- `components/canvas/shortcut-cheat-sheet.tsx`: shadcn `Dialog` listing shortcuts.
- `lib/canvas/duplicate.ts`: pure duplication with new ids and +20 px offset.

Out of scope / non-goals:
- Copy/paste across projects or the OS clipboard → F19 (import/export) or later; not M1. Bring to front / send to back → **dropped from M1** (see D-10c; contradicts ui-context.md table row "Context menu", flagged in status.md). Snap-to-grid, helper lines, grouping, alignment tools → never in M1. Custom key remapping → never. Touch gestures beyond React Flow defaults → not in scope.

## User stories

- US-1: As an editor, I want Delete/Backspace to remove what I selected (nodes and edges) for everyone, but never while I am typing a label.
- US-2: As an editor, I want ⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z (or ⌘/Ctrl+Y) to undo/redo my own changes, and buttons that show when there is nothing to undo.
- US-3: As any participant, I want +/−/Shift+1 and the control bar to zoom and fit smoothly.
- US-4: As an editor, I want ⌘/Ctrl+D to duplicate my selection next to the original, and ⌘/Ctrl+A to select everything.
- US-5: As an editor, I want to right-click a node, edge, or the canvas for the common actions, and use the menu with the keyboard.
- US-6: As any user, I want `?` to show me every shortcut.
- US-7: As a viewer, I must not be able to delete, duplicate, undo or redo, and the cheat-sheet must not advertise those.
- US-8 (failure): As an editor with a dialog open, I expect no canvas shortcut to fire when I type or press Delete in the dialog.

## Key decisions referenced

- D-013 (per-client, non-rebasing undo), D-020 (custom delete handling, selection defaults), F07 D-07a (write path), F09 D-09a.
- **PROPOSED D-10a — Delete reads the selection from the React Flow store at keydown time** (`useStoreApi().getState()`), not via `useNodes()/useEdges()` subscriptions. Rationale: `useNodes()` re-renders its host on every drag/pan frame (react-flow.md §13, S40). The reference prompt's `useNodes()` wording is intent ("read React Flow's selection"), not design.
- **PROPOSED D-10b — Context menu is implemented with shadcn/Radix `ContextMenu`, not `DropdownMenu`.** Rationale: `ContextMenu` natively positions at the pointer, flips/shifts at viewport edges (collision handling), closes on outside click/Esc, and is keyboard operable (arrow keys, typeahead) with no custom positioning code. React Flow's `onNodeContextMenu`/`onEdgeContextMenu`/`onPaneContextMenu` only record **what** was right-clicked; Radix handles **where** the menu opens. The brief asked for `DropdownMenu`; the owner should confirm this substitution (adds `components/ui/context-menu.tsx` via the shadcn CLI).
- **PROPOSED D-10c — Bring to front / send to back are not in M1.** `zIndex` is not among the fields `@liveblocks/react-flow` syncs (liveblocks.md §1: position, width, height, data, handles, endpoints), so z-order would silently differ between clients; putting it in `data` would change frozen schema v1. Revisit in schema v2 (F19 or later).
- **PROPOSED D-10d — Duplicate (`⌘/Ctrl+D`, menu) copies the selected nodes and the edges whose both ends are selected**, with new ids, `position + (20, 20)`, same `width/height/data`, in one batch (one undo step); the duplicates become the new selection. Browser bookmark default is prevented.
- **PROPOSED D-10e — Shortcut ignore rules**: target (or any ancestor) is `input`, `textarea`, `select`, `[contenteditable=""|"true"]`, or `[role="dialog"]`; or `event.isComposing`; or an open shadcn dialog exists (`document.querySelector('[role="dialog"][data-state="open"]')`). Modifier-less single keys (`+ - ? Escape Delete Backspace`) are additionally ignored when `event.metaKey || event.ctrlKey || event.altKey` (so ⌘+- browser zoom still works).

## Reference material

- `context/ui-context.md` "Layout patterns" (control bar bottom-left), "Interaction conventions" (the table the cheat-sheet must mirror), "Accessibility expectations".
- `context/architecture-context.md` canvas section (`deleteKeyCode={null}`, selection props), `context/decision-log.md` D-013/D-020, `context/code-standards.md` (keyboard handlers ignore inputs).
- Research `research/react-flow.md` §4 (selection defaults, `SelectionMode.Partial`, store-based selection, performance warning), §6 (context-menu handlers exist; example code UNVERIFIED), §8 (`zoomIn/zoomOut/fitView` with `duration`), §9 (key props, built-in a11y keys: Esc clears, arrows nudge; undo/redo/copy/duplicate/select-all not built in) — checked 2026-10-22. `research/liveblocks.md` §3 (`useUndo/useRedo/useCanUndo/useCanRedo`; per-client; cleared on reload; **undo applies the inverse without rebasing and can overwrite someone's newer value**) — checked 2026-10-22.
- Reference prompt (intent only): `No_touch_ai/.../17-canvas-ergonomics.md.md`. Reference bug: `current-issues-workspace-implementation.md` §2.

## v2 — canvas productivity (2026-10-28)

Increment to the shipped v1 (PR #15). Nothing above is renumbered; v1 IDs stay valid. Source: `docs/research/excalidraw/00-summary.md` §2 C3 (clipboard format), C6 (shortcut registry) and rows R-001–R-004, R-009–R-012; findings `03-editing-productivity.md` F-02/F-03/F-04/F-06/F-08 (undo set), F-11 (clipboard), F-15/F-16/F-18 (registry, conflicts, `aria-keyshortcuts`), F-20 (tool letters), F-24 (align keys), F-28/F-29 (menu hints), F-49/F-50 (zoom readout, Shift+2), F-53 (grid); `02-arrows-groups-snapping-images-library.md` F-S03 (grid), F-S05/F-S06 (align/distribute), F-C01/F-C03/F-C06 (clipboard, paste position, re-id). Approved framing: D-052 (research adopted), D-053 (Esc cancels — kept), D-054 (duplicate stays +20/+20 — kept), D-055 (partial box select — kept), D-057 (schema v2 lands once, in F22).

| Field | Value |
|---|---|
| Depends on (v2) | v1 (all of F10); F07 `useCanvasMutations.addNode`, `centredDropPosition`, F07 FR-007 centre placement; F06 `<ReactFlow>`/`<Background>` props (grid); `lib/canvas/schema.ts` Zod schemas and `migrate` (paste validation); **F22 optional**: the `text` node kind (plain-text paste, `T`/`N` keys) and `data.locked` (align exclusion) exist only once F22's schema v2 is merged — v2 of F10 must build and pass with or without F22 |
| Depended on by (v2) | F19 insert-mode import (D-059) and F25 library insertion reuse the paste placement helper; F21/F23/F24 register their reserved letters (`X`, `F`, `I`) in the registry; every later feature that adds a shortcut goes through the registry |

### Goals (continue v1)
- G-6: Ctrl+C/X/V move nodes and edges within and between projects with fresh ids, remapped edges and the original relative layout, in one undo step; pasting garbage never writes.
- G-7: a 20 px grid can be switched on per user and nodes snap to it while dragging; the choice survives reload without touching Storage.
- G-8: two or more nodes can be aligned and three or more distributed from the keyboard, the menu and a small toolbar, one undo step each.
- G-9: the control bar shows the zoom level, resets it in one click, and never offers a zoom step that cannot happen.
- G-10: one registry is the only place a key binding is written; a test fails the build on the first duplicate binding; letters are reserved for node insertion before F21–F24 claim them.
- G-11: the undo set is written down and tested: content only, never selection/viewport/grid; remote changes never clear redo.

### Scope (v2)
In: `lib/canvas/registry.ts` (single source of truth), `lib/canvas/clipboard.ts`, `lib/canvas/align.ts`, `lib/canvas/preferences.ts` (grid, localStorage), letter-key insertion, grid toggle in the control bar, zoom readout, `Shift+2`, align/distribute toolbar and menu entries, Copy/Cut/Paste menu entries, cheat-sheet rows, `aria-keyshortcuts` on every control with a binding, explicit undo-set ACs. Out (non-goals, with owner): object snapping/helper lines (R-032, P3), lasso (R-049), groups (F23), Alt+drag duplicate (R-036), node search (R-033), z-order (F23/D-056; F22 only reserves `data.order`), copy-as-PNG (F19/D-060), custom key remapping (never).

### User stories (continue v1)
- US-9: As an editor I want Ctrl+C / Ctrl+X / Ctrl+V (and the menu) to copy, cut and paste what I selected — also into another project tab — landing where my pointer is.
- US-10: As an editor I want a grid I can switch on so dragged nodes line up, remembered per browser.
- US-11: As an editor I want to align or evenly space a selection with one shortcut and undo it with one Ctrl+Z.
- US-12: As any participant I want to see the zoom percentage, reset it, and jump to my selection with Shift+2.
- US-13: As an editor I want to press `R`/`D`/`O`/`P`/`C`/`H` to drop that shape under my pointer.
- US-14 (failure): As a viewer I must not be able to paste, cut, align or insert; as anyone, pasting text copied from a web page must never corrupt the canvas.

### Key decisions (v2, PROPOSED — copy to the decision log on approval)
- **D-10f — Clipboard transport.** Copy/cut write the JSON envelope as `text/plain` with `navigator.clipboard.writeText` (C3; custom MIME types are unreliable) and always keep an in-memory copy. Keyboard paste reads the `paste` DOM event's `clipboardData` (no permission prompt in any browser, Firefox included); menu Paste uses `navigator.clipboard.readText()` and falls back to the in-memory copy when the read is denied or unavailable. Ctrl+V is therefore listed in the registry but handled by the `paste` event, not `keydown`.
- **D-10g — The window key listener moves to the capture phase.** React Flow's node wrapper nudges on any Arrow key and calls `preventDefault` regardless of Ctrl/Meta (VERIFIED, `@xyflow/react` 12.12.0 `index.js` ~L2312), so a bubbling listener (which skips `defaultPrevented` events) could never see Ctrl+Shift+Arrow on a focused node. Handled shortcuts call `stopPropagation()` in the capture phase; the v1 ignore rules (editable target, open overlay, `isComposing`) still run first, so Radix dialogs/menus and the F08 editors keep their keys.
- **D-10h — Shift+2 with nothing selected fits the whole canvas** (same as Shift+1) instead of doing nothing; one label "Zoom to selection".
- **D-10i — Grid snapping applies to drags only.** Inserted (letter key, palette) and pasted nodes are not rounded to the grid; stored positions change only when a user drags. Grid on = `<Background variant="lines">`, grid off = v1 dots.
- **D-10j — Plain-text paste is feature-flagged by the `text` node kind.** If F22's `NODE_KINDS` (F22 FR-002, `features/22-text-and-sticky-notes/`) exists and includes `'text'`, a text node is created at the pointer through F22's `addNodeOfKind('text', pos)`; otherwise non-envelope text is ignored silently. F10 v2 reads the kind list through one `lib/canvas/kinds.ts` shim that falls back to `NODE_SHAPES`, so no F10 code path depends on F22 at build time. **Ordering rule (validation 2026-10-28):** `t`/`n` are owned by this registry (`RESERVED_CHORDS`); whichever of F10 v2 / F22 reaches `main` second does the wiring — F22 registers `addText`/`addSticky` here if the registry exists, otherwise F22 ships them on the interim `matchShortcut` path and T-009 migrates the two entries under the same action ids (F22 FR-008).
- **D-10k — Align/distribute use the node's stored `width`/`height`** (always present when persisted, domain-model) rather than `measured`, so the pure helper is testable and identical on every client.
