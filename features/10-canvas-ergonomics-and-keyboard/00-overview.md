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
