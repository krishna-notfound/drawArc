# Excalidraw research: editing and productivity

Scope: undo/redo, clipboard and duplicate, keyboard shortcuts, context menu, properties panel, colour picker, tools, zoom and viewport, themes, accessibility and responsive behaviour. Written for the drawArc feature mapping (F07 palette, F08 node editing, F09 edges, F10 ergonomics).

Status: read-only research. Nothing committed. No Excalidraw code was executed. No screenshots or live app were opened, so every visual claim is UNVERIFIED (see the last section).

Editor-package vs hosted: unless marked **[HOSTED]**, behaviour is in the open-source `packages/excalidraw` editor. `[HOSTED]` marks `excalidraw-app/` code.

Clone root used below: `C:\Users\krishna\AppData\Local\Temp\claude\C--Users-krishna-Desktop-ghost-ai\08ecd18a-36e3-4565-878b-6db09b1b6b54\scratchpad\excalidraw-src` (commit 14bb42e). Paths in findings are relative to this root.

drawArc baseline used for mapping (from `context/ui-context.md`, `features/08-node-editing/01-requirements.md`, `features/10-canvas-ergonomics-and-keyboard/01-requirements.md`): F08 already has resize (`NodeResizer`, min 48x32), double-click/Enter label editor, 8-swatch colour toolbar with roving tabindex, one undo entry per gesture. F10 already has a bottom-left control bar (zoom out, fit, zoom in, undo, redo with disabled state), a shortcut map (mod+z/shift+z/y, +/-, shift+1, Escape, mod+a, mod+d, ?), Delete/Backspace, a pane/node/edge context menu (duplicate, delete, select all, fit view), a `?` cheat-sheet, and per-client Liveblocks undo. F10 duplicate is +20/+20 offset (FR-007). F10 states z-order is out of scope because `zIndex` is not synced by `@liveblocks/react-flow`.

---

## 1. Sources inspected

Repository files (clone root above):

- `packages/excalidraw/history.ts` (full read of model, record, undo/redo core)
- `packages/excalidraw/actions/actionHistory.tsx` (undo/redo actions, executeHistoryAction guard, keyTests)
- `packages/element/src/store.ts` (CaptureUpdateAction doc, getObservedAppState ~L1000-1030)
- `packages/excalidraw/actions/shortcuts.ts` (shortcutMap, full)
- `packages/excalidraw/components/HelpDialog.tsx` (all shortcut rows L140-525)
- `packages/excalidraw/actions/manager.tsx` (handleKeyDown dispatch, conflict rule)
- `packages/excalidraw/components/App.tsx` (keydown guards ~L5240-5270, tool/lock keys ~L5380-5390, S/G/F/I popups ~L5536-5615, toggleLock ~L4766-4800, getContextMenuItems ~L11222-11300, addElementsFromPasteOrLibrary ~L4618-4660, Alt-handling ~L5290-5300, scroll state ~L4483-4495)
- `packages/excalidraw/components/App.clipboard.ts` (paste position L186-230; text paste at pointer L117-120)
- `packages/excalidraw/components/App.duplicate.ts` (alt-drag duplicate, comment L53, commit L195)
- `packages/excalidraw/actions/actionDuplicateSelection.tsx` (in-place duplicate, L33-120)
- `packages/excalidraw/actions/actionClipboard.tsx` (copy/cut/paste/copy-as-PNG/SVG/text keyTests)
- `packages/excalidraw/actions/actionDeleteSelected.tsx` (keyTest L319)
- `packages/excalidraw/actions/actionSelectAll.ts`, `actionDeselect.ts`, `actionFinalize.tsx` (keyTests)
- `packages/excalidraw/actions/actionCanvas.tsx` (zoom in/out/reset, fit/selection, theme toggle, clear canvas; keyTests and zoom step)
- `packages/excalidraw/actions/actionZindex.tsx`, `actionAlign.tsx`, `actionGroup.tsx`, `actionFlip.ts`, `actionStyles.ts`, `actionLink.tsx`, `actionElementLock.ts`, `actionToggleZenMode.tsx`, `actionToggleGridMode.tsx`, `actionToggleStats.tsx`, `actionToggleViewMode.tsx`, `actionToggleObjectsSnapMode.tsx`, `actionToggleSearchMenu.ts`, `actionMenu.tsx`, `actionProperties.tsx` (keyTests L1118-1150)
- `packages/excalidraw/actions/shapeActionPredicates.ts` (predicate rules), `packages/element/src/comparisons.ts` (per-type capability helpers)
- `packages/excalidraw/components/Actions.tsx` (SelectedShapeActions L129-215, ZoomActions L877, UndoRedoActions L891)
- `packages/excalidraw/components/ContextMenu.tsx` (filtering, separators, checkmarks, kbd hints)
- `packages/excalidraw/components/Tools.tsx` (tool letter/numeric keys, Shift-bound tools, eraser toggle, tooltip labels)
- `packages/common/src/utils.ts` (`isWritableElement` L113-125, `updateActiveTool` L297)
- `packages/common/src/constants.ts` (ZOOM_STEP/MIN/MAX L365-367, ROUNDNESS, ROUGHNESS, STROKE_WIDTH)
- `packages/common/src/colors.ts` (COLOR_PALETTE L193+, shades L210-217)
- `packages/excalidraw/components/ColorPicker/` (`colorPickerUtils.ts` L38-42 hotkeys, `keyboardNavHandlers.ts` L150-175, `Picker.tsx` L152, `PickerColorList.tsx` L116, `ColorInput.tsx` L91)
- `packages/excalidraw/components/Stats/` (directory listing only: DragInput, Position, Dimension, FontSize, CanvasGrid)
- `packages/excalidraw/renderer/interactiveScene.ts` (L110-130 dark-mode colour mapping comment), `css/theme.scss` (L6, L185 `--theme-filter`)
- `packages/excalidraw/components/LayerUI.tsx` (scroll-back button L660-690), `components/MobileMenu.tsx` (L1-30 structure), `components/IconButton.tsx` (title/aria-keyshortcuts props)
- `packages/excalidraw/components/App.wheel.ts` (MAX_STEP L127), `components/App.viewport.ts` (scroll/snap-back animations L54-65, L407-420)
- `packages/excalidraw/locales/en.json` (style and layer labels L2-110)
- `packages/excalidraw/components/main-menu/` (DefaultMainMenu in LayerUI.tsx L111-134)
- `excalidraw-app/App.tsx` L600-615, L745-752, L960-970 **[HOSTED]**; `excalidraw-app/collab/Collab.tsx` L405-420 **[HOSTED]**
- `dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx` L120-140 (captureUpdate table), `.../props/props.mdx` L68

URLs: none fetched in this pass (the repo was clear enough). https://docs.excalidraw.com not opened.

Not opened: any image under `dev-docs/` or `public/`; any running app.

---

## 2. Findings

Format per CLAUDE.md section 9: name · observed behaviour · evidence · drawArc mapping · React Flow fit · priority (P1 daily, P2 valuable, P3 later, P4 skip) · risks.

### 2.1 Undo / redo

**F-01 Local history model (two stacks of inverse deltas)**
- Observed: each local durable change is recorded as an inverse `HistoryDelta` on `undoStack`; undo pops, applies, and pushes the redo entry. Redo stack is cleared only when a non-empty element change is recorded, not on appState-only changes.
- Evidence: `packages/excalidraw/history.ts` L97-140 (`record`, `undoStack`, `redoStack.length = 0` guarded by `historyDelta.elements.isEmpty()`), L150-175 (undo/redo pop/push).
- drawArc mapping: F10 FR-003/FR-012 already rely on Liveblocks `useUndo`/`useRedo`; keep. Excalidraw's model is a reference for "what counts as a step".
- React Flow fit: app-level (Liveblocks), not React Flow.
- Priority: P2 (reference).
- Risks: none for drawArc; do not replace Liveblocks undo with a custom stack (collaboration design already approved).

**F-02 What undo covers (observed app state)**
- Observed: undo covers elements plus a fixed subset of appState: `name`, `editingGroupId`, `viewBackgroundColor`, `selectedElementIds`, `selectedGroupIds`, `croppingElementId`, `activeLockedId`, `lockedMultiSelections`, and the selected linear element id and editing flag. Zoom, scroll, active tool, grid mode, and panel state are not in the list, so they are not undone.
- Evidence: `packages/element/src/store.ts` `getObservedAppState` (~L1005-1030).
- drawArc mapping: upgrade F10 FR-003 documentation: undo covers node/edge data and positions only; viewport and selection are not undo steps (confirm selection, see F-03).
- React Flow fit: app logic (Liveblocks storage contents decide the undo set, not React Flow store).
- Priority: P1 (defines expected undo behaviour for users).
- Risks: confirm the F10 EC-009 "history per connection" wording still matches.

**F-03 Selection changes may enter the undo stack**
- Observed: the record path accepts any non-empty delta, and the comment in `record` says an appState-only change such as a click that unselects should not wipe redo. That implies pure selection deltas can be pushed as undo steps.
- Evidence: `packages/excalidraw/history.ts` L130-140 (comment and `redoStack` reset condition); `store.ts` `selectedElementIds` is in the observed list (F-02).
- drawArc mapping: F10 must keep selection out of Liveblocks undo (selection is per-user state, not shared storage). Confirm F08/F10 do not write selection to storage.
- React Flow fit: native (React Flow selection is client state); keep it out of Liveblocks.
- Priority: P1 (avoid undo stepping through selection clicks).
- Risks: UNVERIFIED end-to-end whether a bare click creates a stack entry in the running app (see section 4).

**F-04 Undo is blocked during in-progress gestures**
- Observed: undo/redo are no-ops while a multi-element is being created, resize is in progress, a drag or selection box is active, a text edit is open, a flowchart is being created, or a sketch is pending. The action then returns `EVENTUALLY` (no entry).
- Evidence: `packages/excalidraw/actions/actionHistory.tsx` L27-45 (`executeHistoryAction` guard list), L46-48.
- drawArc mapping: F08 FR-004 (one undo per gesture) and F10 FR-003. Add: undo shortcut is a no-op during an active drag or resize (guard, do not flush mid-gesture).
- React Flow fit: extra interaction logic (read `dragging`/resize state from the React Flow store or the F08 hook).
- Priority: P2.
- Risks: keyboard undo during drag could otherwise commit a half-applied state.

**F-05 Each undo is a new collaborative version**
- Observed: when a history delta is applied, `version` and `versionNonce` are excluded so the result always carries a new version, and elements missing from the scene fall back to the local snapshot. Undo results are recorded with `NEVER` so they do not re-enter history.
- Evidence: `packages/excalidraw/history.ts` L25-45 (`applyTo` excludedProperties and fallback comment), `actionHistory.tsx` L60 (`captureUpdate: NEVER`), `history.ts` `record` ignores `HistoryDelta` instances.
- drawArc mapping: Liveblocks equivalent is already in F10 FR-012 (inverse applied without rebase). No change; this confirms the design choice in F10 EC-003/EC-005 is the normal one.
- React Flow fit: collaboration (Liveblocks).
- Priority: P3 (reference).
- Risks: Excalidraw re-stamps versions to make remote peers accept undo; Liveblocks handles it differently, so do not copy the version logic.

**F-06 Capture modes: IMMEDIATELY / EVENTUALLY / NEVER**
- Observed: updates declare whether they are undoable immediately, eventually (async multi-step), or never (remote, scene init). Zoom/viewport actions use `EVENTUALLY`, so they never create a step at the time they run.
- Evidence: `packages/element/src/store.ts` L40-60 (enum docs); `dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx` L125-135 (public table); `actions/actionCanvas.tsx` L152, L206, L265 (zoom uses EVENTUALLY).
- drawArc mapping: F10 zoom must not create undo steps. Liveblocks already does this because viewport is not in storage; state the rule in F10 AC.
- React Flow fit: native (viewport is React Flow state).
- Priority: P2.
- Risks: none.

**F-07 Undo and redo shortcuts and visible buttons**
- Observed: undo = Ctrl/Cmd+Z; redo = Ctrl/Cmd+Shift+Z, plus Ctrl/Cmd+Y. The help dialog lists Ctrl+Y only on Windows. Buttons are disabled when the respective stack is empty, driven by an emitter.
- Evidence: `actions/actionHistory.tsx` L83-88, L126-130 (keyTests), L86-110 (disabled via `isUndoStackEmpty`), `components/HelpDialog.tsx` redo row (`isWindows` branch).
- drawArc mapping: matches F10 FR-006 and FR-003. No change.
- React Flow fit: app UI.
- Priority: P1 (already planned).
- Risks: none.

**F-08 Undo/redo in the hosted app** [HOSTED]
- Observed: hosted collab and storage restore use `NEVER` for remote or restored scene updates; image status changes made locally are written with `NEVER` as well (not undoable).
- Evidence: `excalidraw-app/App.tsx` L612 and L749 (`NEVER` on restore/import); `excalidraw-app/collab/Collab.tsx` L419 (image status to `pending`, `NEVER`).
- drawArc mapping: rule for drawArc: system or sync writes (status flags, restore, reconnect) must not create undo entries. F10 EC-009 already covers reload; add the rule explicitly.
- React Flow fit: collaboration.
- Priority: P2.
- Risks: a sync flag written as a user change would pollute undo.

### 2.2 Duplicate, copy, paste, cut, delete

**F-09 Ctrl/Cmd+D duplicates in place (no offset)**
- Observed: `actionDuplicateSelection` calls `duplicateElements` with `type: "in-place"`, so the copies sit at the same coordinates as the originals and are selected. No x/y offset is applied in the action.
- Evidence: `actions/actionDuplicateSelection.tsx` L33-70, L94-110 (selection of duplicates); `packages/element/src/duplicate.ts` (`duplicateElements`).
- drawArc mapping: F10 FR-007 specifies +20/+20 offset. Owner decision: keep the offset (visible copy) or match Excalidraw (in place, then drag). Recommend keeping F10's offset because stacked copies on a diagram are hard to see; flag as a decision, not a bug.
- React Flow fit: custom (clone nodes and edges, remap ids).
- Priority: P2.
- Risks: in-place copies on a live collaborative canvas can hide the duplicate from other users until they move it.

**F-10 Alt+drag duplicates the dragged selection**
- Observed: holding Alt while dragging a selection clones it; the clone is committed on pointer-up. The duplicate logic is isolated in an `AppDuplicate` class.
- Evidence: `components/App.duplicate.ts` L53 (alt-drag comment), L195 (`commitDraggedDuplicates`); `components/App.tsx` L9463 (call site); help dialog row "Alt + drag" in `HelpDialog.tsx`.
- drawArc mapping: new interaction (not in F10). Useful for diagrams (fan-out copies). Optional for MVP.
- React Flow fit: extra interaction logic (on drag start with Alt, create copies and drag them; React Flow has no built-in alt-clone).
- Priority: P3.
- Risks: must integrate with F08 drag undo (one entry for the whole drag, F08 FR-004).

**F-11 Copy, cut, paste use the system clipboard with placement rules**
- Observed: Ctrl+C / Ctrl+X / Ctrl+V. On desktop, pasted elements land at the last pointer position (`cursor`). On phone form factor, they land at viewport centre. Pasting text creates a text element at the last pointer position. Paste is ignored when the pointer is not over the canvas or focus is in a text input.
- Evidence: `components/App.clipboard.ts` L186-230 (`position: formFactor === "desktop" ? "cursor" : "center"`), L117-120 and L428-433 (text paste at `viewport.lastPosition`), L330-345 (guards: target not writable, element under pointer is the canvas); `components/App.tsx` L4625-4640 (`position` resolution); `actions/actionClipboard.tsx` L114-127 (cut keyTest).
- drawArc mapping: new feature. Copy/paste of nodes and edges (with id remapping and edge endpoint remapping, same rules as F10 FR-007) is a P1 productivity gap for a diagramming tool. Paste at cursor (last pointer position) is the expected default.
- React Flow fit: custom (serialise selected nodes/edges to clipboard JSON, remap ids, insert via the collaborative mutation hook; React Flow has no built-in clipboard).
- Priority: P1.
- Risks: pasting into another user's canvas is a write (viewer check); clipboard permission on some browsers; paste from external apps must be ignored safely (validate JSON schema server-side or in the hook).

**F-12 Paste as plain text and copy as PNG / SVG / text**
- Observed: Ctrl+Shift+V pastes as plain text; Shift+Alt+C copies as PNG; copy as SVG and copy as text are menu items. Export copies are a separate action family.
- Evidence: `actions/actionClipboard.tsx` L132-256 (copy as SVG/PNG, keyTest Shift+Alt+C at L256), `components/HelpDialog.tsx` (paste as plaintext row); `components/App.clipboard.ts` L428-440.
- drawArc mapping: copy as PNG/SVG is export (F19 import-export, Future). Paste-as-text is low value for nodes. Skip for MVP.
- React Flow fit: server/export (not React Flow).
- Priority: P4 (PNG/SVG); P3 (plain text paste if F-11 lands).
- Risks: none.

**F-13 Delete and Backspace; Ctrl+Delete clears the canvas with confirmation**
- Observed: Delete or Backspace (without Ctrl) deletes the selection. Ctrl/Cmd+Delete opens a confirm dialog for "clear canvas"; it is not a single-key action.
- Evidence: `actions/actionDeleteSelected.tsx` L319-321 (keyTest without Ctrl); `actions/shortcuts.ts` `clearCanvas: CtrlOrCmd+Delete`; `components/App.tsx` ~L5600-5601 (`activeConfirmDialogAtom` "clearCanvas").
- drawArc mapping: F10 FR-005 matches Delete/Backspace. Clear-canvas is not in F10; new feature only if owner wants it (destructive, needs confirmation; F13/F12 may cover).
- React Flow fit: app UI (confirm dialog).
- Priority: P3.
- Risks: destructive action on a shared canvas; if added, use the F12 role check and confirm dialog without a text field (ui-context rule).

**F-14 Select all**
- Observed: Ctrl/Cmd+A selects all non-locked, non-deleted elements.
- Evidence: `actions/actionSelectAll.ts` L69 (keyTest), L1-30 (filters).
- drawArc mapping: matches F10 FR-006 (mod+a). Locked nodes are not in drawArc yet; if a lock is added, mirror this rule.
- React Flow fit: native (`selectAll` via React Flow store).
- Priority: P1 (already planned).
- Risks: none.

### 2.3 Keyboard shortcuts and discoverability

**F-15 Complete shortcut map**
- Observed: about 90 distinct shortcuts across tools, view, editor, and history. Full table in Appendix A.
- Evidence: `actions/shortcuts.ts` (shortcutMap); per-action `keyTest` functions (files listed in section 1); `components/HelpDialog.tsx` L140-525.
- drawArc mapping: use Appendix A as the checklist for F10 FR-006 and the cheat-sheet (F10 FR-010). Upgrade F10 FR-006 to include zoom to selection, Shift+1 (already), and any new shortcuts the owner approves.
- React Flow fit: one window listener (F10 NFR-004).
- Priority: P1 (reference).
- Risks: scope creep; approve only a subset.

**F-16 Shortcut conflicts cancel the action**
- Observed: if more than one action's `keyTest` matches the same event, none runs and a console warning is printed.
- Evidence: `actions/manager.tsx` L92-118 (`data.length !== 1` branch with `console.warn`).
- drawArc mapping: upgrade F10 FR-004 (one listener): add a test that every shortcut in the registry maps to exactly one action (catches future collisions). Cheap, high value.
- React Flow fit: app logic (no RF change).
- Priority: P2.
- Risks: none.

**F-17 Shortcuts ignored inside text fields; Escape still passes through**
- Observed: while focus is in a writable element (text editor or input), shortcuts are skipped except Escape. Ctrl+- and Ctrl+= in inputs are prevented so the browser does not zoom the page. Arrow keys inside input-like elements are ignored.
- Evidence: `components/App.tsx` ~L5248-5268 (guards); `packages/common/src/utils.ts` L113-125 (`isWritableElement`: wysiwyg, `BR`, `contenteditable` div).
- drawArc mapping: matches F10 EC-001 and ui-context. No change; note Excalidraw's Escape exception (the label editor cancels on Escape, F08 FR-007).
- React Flow fit: app logic.
- Priority: P1 (already planned).
- Risks: none.

**F-18 Platform-specific labels and tooltips with shortcut hints**
- Observed: `getShortcutKey` renders Ctrl or Cmd (and the Mac-specific send-to-back chord). Tool buttons show "Label — key" in their title. Buttons with shortcuts add `aria-keyshortcuts`; zoom buttons carry the shortcut in `aria-keyshortcuts` and no native title.
- Evidence: `components/Tools.tsx` L180-190, L281-290 (title `label — shortcut`); `actions/actionCanvas.tsx` L166-170 (`aria-keyshortcuts`, comment about removed native title); `components/IconButton.tsx` L21, L129-170 (`title`, `aria-keyshortcuts` props); `actions/shortcuts.ts` `isDarwin` branches.
- drawArc mapping: matches F10 platform-labels rule. Add `aria-keyshortcuts` to F10 control-bar buttons and to F08 swatches (small upgrade, accessibility).
- React Flow fit: app UI.
- Priority: P2.
- Risks: none.

**F-19 Help dialog (cheat-sheet): grouped islands, scoped sections**
- Observed: the dialog has a "Shortcuts" section with three islands: Tools (tool letters and numbers, text editing rules, crop, lock, link), View (zoom, pan, zen, snap, grid, view mode, theme, stats, search, command palette), Editor (flowchart, move canvas, clear, clipboard, arrange, align, duplicate, lock, undo/redo, group, flip, style toggles, font size). Some rows are conditional (theme toggle only if enabled; copy-as-PNG only if the browser supports it).
- Evidence: `components/HelpDialog.tsx` L140-525 (islands `HelpDialog__island--tools`, `--view`, `--editor`; conditionals at the theme row and copy-PNG row).
- drawArc mapping: upgrade F10 FR-010 from one flat table to three captioned groups (for example: Canvas, Selection and edit, History and view). Keep the first ten rows verbatim per F10 rule.
- React Flow fit: app UI (Radix Dialog).
- Priority: P3.
- Risks: a grouped table must keep the copy test (F10 AC-019) passing.

**F-20 Tool hotkeys: letter and number pairs, Shift-bound tools, and a shape palette**
- Observed: each tool has a letter key and often a number key: V/1 selection, R/2 rectangle, D/3 diamond, O/4 ellipse, A/5 arrow, L/6 line, P or X/7 freedraw, T/8 text, N sticky, 9 image, E/0 eraser, F frame, K laser, B bucket fill, H hand. Shift+X is the autoshape (draw-to-shape) tool. Lookup is case-insensitive and CapsLock-safe; shift-bound tools require Shift.
- Evidence: `components/Tools.tsx` L60-150 (`letterKey`, `numericKey`, `shiftKey`), L190-215 (`findShapeByKey`), L294 (selection shortcut toggles selection tools); `components/HelpDialog.tsx` tools island.
- drawArc mapping: new feature. Keyboard shape insertion from F07 palette: one letter per node type (for example R rectangle, D decision, S service, etc.; owner chooses) plus Esc to cancel. Do not map numbers unless the palette has numbered categories.
- React Flow fit: app UI (insert node at cursor or viewport centre; then add to React Flow via mutation hook).
- Priority: P2.
- Risks: letter collisions with browser shortcuts (Ctrl-prefixed) and with F10 keys (`?`, `+`, `-`); reserve letters in one registry.

**F-21 Tool lock (Q): sticky tool vs auto-return**
- Observed: Q toggles a "locked" tool. When locked, the active tool stays after each element is created. When unlocked, the tool returns to the selection tool after one element. Host-controlled (`activeTool` prop) disables the toggle.
- Evidence: `components/App.tsx` L5386-5390 (Q key), L4766-4800 (`toggleLock`, host guard at L4767-4769), L1045-1048 (`isToolLocked`); `packages/common/src/utils.ts` L297+ (`updateActiveTool`, `locked`, `lastActiveTool`); `components/HelpDialog.tsx` (toolBar.lock row).
- drawArc mapping: new feature for F07 palette: "keep palette tool armed" toggle (sticky add-node mode). Optional; P2 once F07 exists.
- React Flow fit: app UI (palette state only; React Flow receives the new node).
- Priority: P2.
- Risks: a sticky mode must not swallow the Escape or Delete keys.

**F-22 Escape precedence**
- Observed: Escape first finishes the in-progress element or linear edit (`actionFinalize`), then deselects (`actionDeselect`). Enter also finalizes multi-point elements.
- Evidence: `actions/actionFinalize.tsx` L421-424 (keyTest), `actions/actionDeselect.ts` L131-134 (keyTest).
- drawArc mapping: matches F10 precedence list. No change.
- React Flow fit: app logic.
- Priority: P1 (already planned).
- Risks: none.

**F-23 Single-letter style popovers: S (stroke), G (background), Shift+F (font), I / Shift+G / Shift+S (eyedropper)**
- Observed: S opens the stroke colour popover, G the background popover (only when the selection or tool has a background), Shift+F the font popover, I the eyedropper, and Shift+S / Shift+G the eyedropper for stroke / background. Some require a selection (plain selection tool with nothing selected returns early).
- Evidence: `components/App.tsx` L5536-5565 (S, G), L5570-5580 (Shift+F), L5600-5615 (eyedropper keys).
- drawArc mapping: new, P3. Relevant only if F08 colour toolbar gains a keyboard-open path; otherwise skip.
- React Flow fit: app UI (popover open state).
- Priority: P3.
- Risks: letter keys collide with the F-20 palette letters; reserve them first.

**F-24 Align and distribute shortcuts**
- Observed: Ctrl/Cmd+Shift+Arrow aligns the selection to top, bottom, left or right; distribute is offered when more than two elements are selected.
- Evidence: `actions/actionAlign.tsx` L97-200 (keyTests); `actions/shapeActionPredicates.ts` (`distribute: targetElements.length > 2`); `components/HelpDialog.tsx` align rows.
- drawArc mapping: new feature. Align and distribute as a P2 properties-panel item (F-27); must write one undo entry for the batch (F08 FR-012 pattern).
- React Flow fit: app logic (compute positions, then one batched store update; React Flow has no built-in align).
- Priority: P2.
- Risks: Ctrl+Shift+Arrow may conflict with browser or OS shortcuts on some platforms; test on macOS and Windows.

**F-25 Arrange (z-order) shortcuts**
- Observed: Ctrl/Cmd+[ and ] send backward / bring forward; send-to-back and bring-to-front use Ctrl+Shift+[ and ] (Windows) or Ctrl+Alt+[ and ] (macOS). Available from the context menu on desktop only.
- Evidence: `actions/actionZindex.tsx` L37-40, L67-70, L96-100, L134-137 (keyTests); `components/App.tsx` element context menu `zIndexActions` only on desktop (~L11272-11290); `actions/shortcuts.ts` (send-to-back platform branch).
- drawArc mapping: conflicts with F10 decision (z-order not synced). Owner decision: keep out, or add a synced `zIndex` field (needs architectural approval; F10 explicitly excluded it).
- React Flow fit: needs architectural approval (`zIndex` sync through `@liveblocks/react-flow` is not supported as-is per F10).
- Priority: P3 (decision) .
- Risks: a local-only z-order would diverge between users.

**F-26 Group, ungroup, lock, link, flip, and wrap shortcuts**
- Observed: Ctrl+G group, Ctrl+Shift+G ungroup, Ctrl+Shift+L lock/unlock, Ctrl+K link, Shift+H / Shift+V flip, W wrap text.
- Evidence: `actions/actionGroup.tsx` L203-204 and L307-310; `actions/actionElementLock.ts` L147-151; `actions/actionLink.tsx` L40; `actions/actionFlip.ts` L55, L80; `actions/actionToggleWrap.ts` L12-15.
- drawArc mapping: Ctrl+K link maps to node hyperlink (new, P3). Group = React Flow parent or sub-flow (new, needs architectural approval, P3). Lock (P3). Flip (P4; flow diagrams rarely need mirror). W wrap: skip (drawArc labels already wrap per F08 FR-014).
- React Flow fit: flip = custom (transform data); group = needs architectural approval (parent/sub-flow changes data model); link = app UI.
- Priority: P3 / P4 as stated.
- Risks: group changes persistence schema; do not add without approval.

**F-27 Search (Ctrl+F) and command palette (Ctrl+/ or Ctrl+Shift+P)**
- Observed: Ctrl/Cmd+F opens an element search menu; the command palette is bound to Ctrl/Cmd+/ and Ctrl/Cmd+Shift+P (Firefox uses one key only, per the help dialog).
- Evidence: `actions/actionToggleSearchMenu.ts` L57; `actions/shortcuts.ts` `searchMenu`, `commandPalette`; `components/HelpDialog.tsx` view island (isFirefox branch); `components/CommandPalette/CommandPalette.tsx` (keyTest).
- drawArc mapping: new feature. Node search (find by label) is valuable for large diagrams; command palette is P4 for MVP.
- React Flow fit: app UI (search over nodes; fitView to match).
- Priority: P2 (node search), P4 (command palette).
- Risks: Ctrl+F is the browser find shortcut; must `preventDefault` inside the canvas only.

### 2.4 Context menu

**F-28 Context menu structure per target**
- Observed: three menus. Canvas: paste; copy PNG/SVG/text; select all; unlock all; toggles for grid, object snapping, arrow binding, midpoint snapping, zen mode, view mode, stats. View mode gets a reduced list. Element: cut, copy, paste; frame actions; crop; copy/paste styles; group, auto-resize text, bind/unbind text, ungroup; add to library; z-order (desktop only); flip; line editor; link and copy link; duplicate and lock; delete.
- Evidence: `components/App.tsx` `getContextMenuItems` L11222-11315 (lists and separators).
- drawArc mapping: upgrade F10 FR-009 (node, edge, pane menus). Excalidraw suggests adding paste to the pane menu once F-11 exists; add toggles only where drawArc has a matching setting (snap to grid, if approved).
- React Flow fit: app UI (Radix context menu, per-target item lists).
- Priority: P2.
- Risks: long menus hurt discoverability; keep node menu short.

**F-29 Predicate-filtered items, collapsed separators, checkmarks, and shortcut hints**
- Observed: each menu item may have a `predicate`; failing items are dropped. Separators are dropped when adjacent to another separator or at the start. Toggle items show a checkmark from `checked(appState)`. Each row shows its shortcut in a `<kbd>` from `shortcutName`.
- Evidence: `components/ContextMenu.tsx` L36-60 (filter), L71-79 (separator collapse), L115 (`checkmark: item.checked?.(appState)`), L119 (`<kbd>` hint); `actions/actionToggleGridMode.tsx` L29 (`checked`), `actions/actionToggleStats.tsx` L25.
- drawArc mapping: adopt for F10 context menu: predicate per item (viewer hides mutating items, matches F10 FR-011), separator collapse, `<kbd>` hint generated from the same registry as the cheat sheet (F10 platform-label helper). Checkable items only if drawArc adds toggles.
- React Flow fit: app UI.
- Priority: P2.
- Risks: none.

**F-30 Copy styles and paste styles (Ctrl+Alt+C / Ctrl+Alt+V)**
- Observed: copies stroke, background, fill, stroke width, roughness, opacity, font and related style from the selected element and applies them to the other selection; the actions are in the element menu.
- Evidence: `actions/actionStyles.ts` L80-82 (copy keyTest), L250-252 (paste keyTest); element menu in `components/App.tsx` L11290-11300 (copyStyles and pasteStyles).
- drawArc mapping: new feature. Useful with F08 colour and resize. "Copy node style (colour, font size, border)" to paste onto other nodes: P2.
- React Flow fit: app logic (update node `data` for selected nodes in one batch).
- Priority: P2.
- Risks: style attributes are per node type; keep the list to F08 fields.

### 2.5 Properties panel

Excalidraw shows only the controls that apply to the current selection or active tool. The rules are in `actions/shapeActionPredicates.ts` (L88-185) and per-type helpers in `packages/element/src/comparisons.ts` (L3-68). Predicates use `some()` over the selection, so mixed selections show a control if any element supports it.

**F-31 Panel composition and per-type visibility**
- Observed: stroke colour shows if any element has a stroke colour. Background colour shows only for types with a background (rectangle, sticky note, iframe, embeddable, and a few more). Fill style shows only when a background is not transparent. Stroke width, stroke style, sloppiness (roughness), roundness, arrowheads and arrow type each show for specific types. Text controls show when any text is selected or the text tool is active. Opacity shows for most tools. Layers, align, and link follow separate predicates.
- Evidence: `actions/shapeActionPredicates.ts` L104-185; `components/Actions.tsx` L129-215 (render order); `packages/element/src/comparisons.ts` L3-68.
- drawArc mapping: new feature "node properties panel" (P2 overall). For drawArc node types, the set is small: colour (F08 has it in toolbar), border style, border width, font size, text align, and label. Reuse the predicate pattern: show a control only if at least one selected type supports it.
- React Flow fit: app UI (floating panel or NodeToolbar; reads selection from React Flow store).
- Priority: P2.
- Risks: panel crowding; mixed-value display rules are not covered by this pass (UNVERIFIED how mixed values render).

**F-32 Stroke style: solid, dashed, dotted**
- Observed: stroke style choices are Solid, Dashed, Dotted; shown for types with `hasStrokeStyle`.
- Evidence: `packages/excalidraw/locales/en.json` L37-39 (`strokeStyle_solid`, `_dashed`, `_dotted`); `packages/element/src/comparisons.ts` L42-50 (`hasStrokeStyle`).
- drawArc mapping: useful for architecture diagrams (dashed for optional or async links, dotted for external). Edge stroke style belongs to F09; node border style to F08.
- React Flow fit: native (edge `style.strokeDasharray`; node border via CSS class).
- Priority: P2.
- Risks: dash patterns must stay legible at zoom.

**F-33 Stroke width: thin, bold, extra bold**
- Observed: three widths (labels Thin, Bold, Extra bold, and a middle default); the freedraw set differs slightly.
- Evidence: `en.json` L (`thin`, `bold`, `extraBold`); `packages/common/src/constants.ts` L477-515 (`STROKE_WIDTH_KEYS`, `STROKE_WIDTH`, `DEFAULT_ELEMENT_STROKE_WIDTH_KEY = "medium"`).
- drawArc mapping: F09 edge width presets (for example 1, 2, 3 px) and F08 border width. P2.
- React Flow fit: native (edge style; node CSS).
- Priority: P2.
- Risks: none.

**F-34 Edge roundness and arrow type: sharp, round, elbowed**
- Observed: arrow type has Sharp, Curved (round) and Elbow choices; line roundness Sharp or Round. Elbow arrows have their own behaviour (bindings are not supported for all cases).
- Evidence: `en.json` L43-46 (`arrowtype_sharp`, `_round`, `_elbowed`), `sharp`/`round` labels; `packages/excalidraw/actions/actionProperties.tsx` (roundness and arrow type actions); `comparisons.ts` `canChangeRoundness`, `toolIsArrow`.
- drawArc mapping: upgrade F09 edge type options to match React Flow built-in edge types (bezier, straight, step, smoothstep). Elbow ~ step/smoothstep. Sharp ~ step; Round ~ smoothstep. React Flow names are from RF docs knowledge; UNVERIFIED in this pass.
- React Flow fit: native (built-in edge types).
- Priority: P2.
- Risks: changing edge type after creation needs the F09 update path.

**F-35 Arrowheads: 15 end styles including crow's-foot and cardinality**
- Observed: each end (start and end) can use None, Arrow, Bar, Circle (solid or outline), Triangle (solid or outline), Diamond (solid or outline), Crow's foot (many, one, one or many), Cardinality (one, many, one or many, exactly one, zero or one, zero or many). Arrowheads are shown for arrow tools only.
- Evidence: `en.json` L52-70 (`arrowhead_*` labels); `comparisons.ts` `canHaveArrowheads` (arrow only); `shapeActionPredicates.ts` `arrowheads` predicate.
- drawArc mapping: upgrade F09: start and end markers (arrow, open arrow, diamond, crow's foot, one, many for ER diagrams). A short list (none, arrow, triangle, diamond, crow's foot) covers most system diagrams.
- React Flow fit: native (`markerStart`, `markerEnd` with custom marker definitions in SVG defs).
- Priority: P2 (crow's foot for data-model diagrams: P2; cardinality set: P3).
- Risks: marker defs must be rendered per edge colour.

**F-36 Text controls: font size, font family, alignment**
- Observed: font size has four named steps (Small, Medium, Large, Very large); font family choices are Excalidraw's hand-drawn and code families; text alignment (left, centre, right) and vertical alignment are separate controls. Font size is also adjustable with Ctrl/Cmd+Shift+< and > (keyTest accepts `<`, `,` and `>`, `.`).
- Evidence: `en.json` L83-86 (size labels), L81-82 and font labels; `actions/actionProperties.tsx` L1118-1152 (keyTests for font size); `components/Actions.tsx` L170-185 (text fieldset and alignment).
- drawArc mapping: F08 label: font size (3 presets, e.g. S/M/L) and text alignment (left, centre, right) are P2. Font family: skip (Geist only, ui-context).
- React Flow fit: app UI + node `data` update.
- Priority: P2 (size and align); P4 (family).
- Risks: text size changes must re-measure node size (F08 resize interplay).

**F-37 Opacity, sloppiness and fill style**
- Observed: opacity is a slider; sloppiness is Architect, Artist, Cartoonist (hand-drawn wobble); fill is Hachure, Zigzag, Cross-hatch, Solid, and only applies where a background is set.
- Evidence: `en.json` L88-92 (`hachure`, `zigzag`, `crossHatch`, `solid`), L97-99 (`architect`, `artist`, `cartoonist`), `comparisons.ts` `hasRoughness`, `hasFillStyle`; `shapeActionPredicates.ts` `fill` and `opacity` predicates.
- drawArc mapping: skip for MVP. The sketch look is not part of the drawArc UI direction (dark technical workspace, ui-context). Opacity: P3 for nodes. Fill patterns: P4.
- React Flow fit: native (CSS), if ever needed.
- Priority: P4 (sloppiness, fill); P3 (opacity).
- Risks: adding a sketch style would conflict with the approved visual language.

**F-38 Layers and align groups inside the panel**
- Observed: the panel has a Layers fieldset (send backward, forward, to back, to front) and an Align fieldset; Align shows distribute only with more than two elements.
- Evidence: `components/Actions.tsx` L200-215 (`LayersFieldset`, `AlignFieldset`, `showDistribute`); `shapeActionPredicates.ts` `layers`, `align`, `distribute`.
- drawArc mapping: align and distribute: P2 (F-24). Layers: see F-25 decision.
- React Flow fit: see F-24 and F-25.
- Priority: see sub-findings.
- Risks: see F-24 and F-25.

**F-39 Element actions group: duplicate, delete, group, ungroup, link, crop, line editor**
- Observed: the actions group in the panel shows duplicate, delete, group, ungroup, link (single selection or bound container), crop (single image), and line editor (single linear, not elbow).
- Evidence: `components/Actions.tsx` L200-212 (actions fieldset); `shapeActionPredicates.ts` `link`, `cropEditor`, `lineEditor`.
- drawArc mapping: duplicate and delete already in F10 context menu; add to panel (P2). Link (P3). Crop (skip). Line editor: F09 edge path editing (P3, needs approval).
- React Flow fit: app UI.
- Priority: P2.
- Risks: none.

**F-40 Remembered "current" style for new elements**
- Observed: new elements take the current item style values stored in app state (`currentItem*`), which the panel updates when nothing is selected; the bucket fill tool has its own small panel (colour, fill, opacity).
- Evidence: `components/Actions.tsx` L140-150 (bucket-fill panel); `shapeActionPredicates.ts` (`currentItem` use in predicates); `actions/actionProperties.tsx` (current item updates).
- drawArc mapping: new feature P3: "last used colour and border for new nodes". Low cost once F08 colour exists.
- React Flow fit: app state (not persisted to Liveblocks unless the owner wants it).
- Priority: P3.
- Risks: per-user default must not write shared storage.

### 2.6 Colour picker

**F-41 Palette: named colour families with shades; top picks; custom colours**
- Observed: the picker lists named families (for example black, white, gray, red, pink, grape, violet, blue, cyan, teal, green, yellow, orange, bronze, and so on), each with shades taken from Radix bronze shades [3, 5, 7, 9, 11] for element colours. Transparent is an option. Top picks and five custom colour slots (1 to 5) exist. A hex input validates the value (`aria-invalid`).
- Evidence: `packages/common/src/colors.ts` L193-220 (palette, shades); `components/ColorPicker/ColorPicker.tsx` (palette, custom); `components/ColorPicker/CustomColorList.tsx`; `components/ColorPicker/ColorInput.tsx` L91-92 (hex with `aria-invalid`); `components/ColorPicker/TopPicks.tsx`.
- drawArc mapping: F08 has 8 pairs (fill and text), not a family picker. Upgrade F08 FR-011: add a "More colours" popover with hex input and up to five recent or custom colours, validated against contrast (F08 NFR-006 requires >= 4.5:1 for node text). Owner decision: allow arbitrary colours or only the palette.
- React Flow fit: app UI (popover) + node `data.color`.
- Priority: P2.
- Risks: arbitrary colours can break the 4.5:1 contrast rule; validate or auto-pick a legible text colour.

**F-42 Picker keyboard shortcuts**
- Observed: inside the picker, letters q w e r t / a s d f g / z x c v b select the first 15 palette entries in order; 1 to 5 choose custom colours; arrow keys move between shades; Tab moves between sections; Esc closes; I or holding Alt toggles the eyedropper. Hotkeys for hidden palette entries are still consumed.
- Evidence: `components/ColorPicker/colorPickerUtils.ts` L38-42 (`colorPickerHotkeyBindings`); `components/ColorPicker/keyboardNavHandlers.ts` L87-100 (number and letter hotkeys), L150-175 (Escape, Alt, I, Tab), L250-281 (arrow navigation).
- drawArc mapping: P3. Keyboard colour pick is a nice-to-have once F08 roving tabindex swatches exist (F08 FR-012 already has arrow keys).
- React Flow fit: app UI.
- Priority: P3.
- Risks: letter keys inside a modal must not leak to the canvas (the picker stops propagation; verify in drawArc too).

**F-43 Eyedropper (I, Alt, Shift+S / Shift+G)**
- Observed: the eyedropper samples the canvas colour; the host (not the editor) owns the eyedropper lifecycle through a callback. Hold Alt while the bucket tool is active for a temporary eyedropper.
- Evidence: `components/App.tsx` L3054-3056 (`openEyeDropper`, `setActiveEyeDropper` host callback), L3333-3336 (release), L5606-5615 (I, Shift+S, Shift+G); `components/EyeDropper` (directory; not opened in detail).
- drawArc mapping: new, P3. Sampling DOM colours from React Flow nodes is possible but not trivial; the browser EyeDropper API support is UNVERIFIED for drawArc's target browsers. Skip for MVP.
- React Flow fit: app UI (custom).
- Priority: P3.
- Risks: browser support; sampling a canvas with transparent backgrounds.

**F-44 Colour picker accessibility pattern**
- Observed: the picker is `role="dialog"` with `aria-modal="true"` and an `aria-label` ("Color picker"). Each swatch has `aria-label` in the form "name — keybinding", so the hotkey is announced.
- Evidence: `components/ColorPicker/Picker.tsx` L152 (dialog role); `components/ColorPicker/PickerColorList.tsx` L116 (`aria-label` with keybinding), L80 (`aria-hidden` on decorative element); `components/ColorPicker/ColorPicker.tsx` L315, L421.
- drawArc mapping: adopt for F08 swatches: `aria-label` "Blue — B" style (the swatch name plus shortcut if any). Matches F08 NFR-006 `aria-label`s.
- React Flow fit: app UI.
- Priority: P2.
- Risks: none.

### 2.7 Tools and modes

**F-45 Tool lock and auto-return** — see F-21 (same behaviour; kept in tools section).

**F-46 Hand tool (H), pan with Space, and wheel**
- Observed: H selects the hand tool; Space+drag and wheel pan (help dialog rows). Right-drag and middle-drag pan are not listed (UNVERIFIED).
- Evidence: `components/Tools.tsx` L70-75 (hand letter key), `components/HelpDialog.tsx` (move-canvas row with `Space+drag`, `Wheel+drag`).
- drawArc mapping: React Flow pans natively (`panOnDrag`, `panOnScroll`, middle-button); F10 pan row in ui-context. Skip the hand tool; a visible pan-mode toggle is P4.
- React Flow fit: native.
- Priority: P4.
- Risks: none.

**F-47 Eraser: E or 0, toggle behaviour, and "eraser as tool"**
- Observed: the eraser is a tool with letter E and number 0; it is marked `toggle: true`, so pressing the key again returns to the previous tool.
- Evidence: `components/Tools.tsx` L129-135 (eraser entry, `toggle: true`), `components/App.tsx` L5376-5382 (toggle path for shape keys).
- drawArc mapping: a delete-by-drawing tool does not fit node diagrams. Skip. The toggle pattern (press again to return) is reusable for F07 palette (see F-21).
- React Flow fit: n/a.
- Priority: P4.
- Risks: none.

### 2.8 Zoom and viewport

**F-48 Zoom steps are additive and clamped**
- Observed: zoom in and out change the zoom value by ZOOM_STEP (0.1) per click or key press, not by a multiplicative factor, clamped to MIN_ZOOM 0.1 and MAX_ZOOM 30. Zoom buttons use the viewport centre as the anchor. Wheel zoom uses its own step (MAX_STEP = ZOOM_STEP * 100).
- Evidence: `packages/common/src/constants.ts` L365-367; `components/App.wheel.ts` L127; `actions/actionCanvas.tsx` L131-150 (zoomIn, viewport centre anchor, `nextZoom` = zoom + ZOOM_STEP), L185-205 (zoomOut).
- drawArc mapping: F10 uses React Flow `zoomIn/zoomOut` with duration 200 and minZoom 0.1 / maxZoom from F06. Owner decision: keep React Flow default step or set a fixed step; additive steps read more predictably at low zoom.
- React Flow fit: native (`zoomIn`, `zoomOut`, `zoomTo`).
- Priority: P3.
- Risks: additive steps at 0.1 are slow near max; the 30x max is high for node diagrams (F06 choice).

**F-49 Zoom indicator: percentage readout, click to reset to 100%**
- Observed: the zoom control bar shows the current zoom as a percentage (`(zoom * 100).toFixed(0)%`); clicking it resets to 100%, or to a locked minimum if a zoom lock is set. The zoom-in button is disabled at max and zoom-out at min.
- Evidence: `actions/actionCanvas.tsx` L247-285 (reset zoom label and percentage), L170 and L224 (disabled at MAX and MIN); `components/Actions.tsx` L877-889 (`ZoomActions` row order: out, reset, in).
- drawArc mapping: upgrade F10 FR-001: add a percentage readout between zoom out and zoom in (click resets to 100%). Disabled states already in F10 NFR-006.
- React Flow fit: app UI; read zoom from React Flow store (`useStore` zoom selector).
- Priority: P2.
- Risks: percentage text is a live value; announce changes politely or not at all (avoid noise).

**F-50 Zoom to fit, zoom to selection, and their keys (with an inconsistency)**
- Observed: Shift+1 zooms to fit all content. Shift+2 is labelled in the help dialog as "Zoom to selection" and is the keyTest of `zoomToFitSelectionInViewport` (whose label is "zoom to fit viewport"). Shift+3 is the keyTest of `zoomToFitSelection` (label "zoom to selection"). The shortcut map agrees with the keyTests, so the help text and the action labels disagree.
- Evidence: `actions/actionCanvas.tsx` L312-313 (label zoomToFitViewport), L347-349 (keyTest TWO), L355-356 (label zoomToSelection), L389-391 (keyTest THREE), L397-398 (zoomToFit label), L425-427 (keyTest ONE); `actions/shortcuts.ts` (`zoomToFit: Shift+1`, `zoomToFitSelectionInViewport: Shift+2`, `zoomToFitSelection: Shift+3`); `components/HelpDialog.tsx` L279-284.
- drawArc mapping: F10 has Shift+1 (fit view). Add "Zoom to selection" (fitView over selected nodes, duration 200) on Shift+2 with a single label. Do not copy Excalidraw's label mismatch.
- React Flow fit: native (`fitView({ nodes, duration, padding })`).
- Priority: P2.
- Risks: Excalidraw matches these keys on `event.code` (layout-independent for the digit keys); drawArc should do the same and test it.

**F-51 Scroll-back-to-content button**
- Observed: when the viewport is scrolled outside all content (`scrolledOutside`), a button appears that animates the viewport back to the content (500 ms default; snap-back uses 250 ms). Hidden while a viewport animation runs.
- Evidence: `components/LayerUI.tsx` L660-690 (button when `scrolledOutside`), `components/App.tsx` L4483-4495 (`scrolledOutside` computed and throttled), `components/App.viewport.ts` L54-65 (animation keys and durations), L407-420 (rubberband snap-back).
- drawArc mapping: new, P3. React Flow has no built-in "content offscreen" indicator; compute from node bounds and viewport in the control bar. Could be a small "Fit view" pulse when nodes are off-screen.
- React Flow fit: app UI reading React Flow store (`useStore` for transform and nodes bounds).
- Priority: P3.
- Risks: recalculation cost with 200+ nodes; use the React Flow selector pattern.

**F-52 Stats panel (Alt+/): numeric position and size, editable**
- Observed: the stats panel shows position, dimensions, angle and font size for the selection as draggable numeric inputs (`DragInput`), plus grid and canvas info; toggled by Alt+/ and listed in the canvas context menu with a checkmark.
- Evidence: `components/Stats/` (file names only: `Position.tsx`, `Dimension.tsx`, `Angle.tsx`, `FontSize.tsx`, `DragInput.tsx`, `CanvasGrid.tsx`; contents NOT read, so the "editable numeric" behaviour is UNVERIFIED); `actions/actionToggleStats.tsx` L20-27 (toggle, checkmark); `components/LayerUI.tsx` L427-433 (panel render).
- drawArc mapping: new, P3. A node inspector with x, y, width, height (numeric, undo as one step) would help precision placement; fold into the F-31 properties panel rather than a separate panel.
- React Flow fit: app UI (numeric fields write `position` and `width/height` via the F08 resize/move path).
- Priority: P3.
- Risks: numeric edits must go through the same batched mutation as drag (one undo entry).

**F-53 Grid mode (Ctrl+'), object snapping (Alt+S), and midpoint snapping**
- Observed: Ctrl/Cmd+' toggles a grid; Alt+S toggles object snapping; midpoint snapping is a separate toggle in the canvas menu. Grid and snapping are persisted as appState flags.
- Evidence: `actions/actionToggleGridMode.tsx` L29-33; `actions/actionToggleObjectsSnapMode.tsx` L32-33; `actions/actionToggleMidpointSnapping.tsx`; `components/CanvasGrid.tsx` (grid draw) and `components/Stats/CanvasGrid.tsx` (directory listing).
- drawArc mapping: upgrade F06 or F10: grid snap via React Flow `snapToGrid` / `snapGrid` props (native; check F06 first, as F06 may already cover it). Object snapping (align to nearby nodes): new, P3, needs approval. Midpoint snapping: skip.
- React Flow fit: native (`snapToGrid`, `snapGrid`); object snapping is custom (guides from node bounds).
- Priority: P2 (grid snap); P3 (object snap).
- Risks: grid snap changes stored positions unless only applied on drag.

**F-54 Zen mode (Alt+Z) and view mode (Alt+R)**
- Observed: zen mode hides most UI; view mode disables editing and keeps navigation; both are in the canvas menu with checkmarks.
- Evidence: `actions/actionToggleZenMode.tsx` L22-34; `actions/actionToggleViewMode.tsx` L34-35; `components/App.tsx` L11235-11240 (view-mode menu list).
- drawArc mapping: view mode maps to F12 viewer role (already a read-only mode; no separate toggle needed). Zen mode: P4 (drawArc chrome is already minimal).
- React Flow fit: app UI.
- Priority: P4.
- Risks: a view-mode toggle for owners would conflict with F12 roles if not separated.

### 2.9 Themes

**F-55 Dark-mode canvas uses colour mapping instead of a CSS filter**
- Observed: the interactive canvas once used a CSS filter `invert(93%) hue-rotate(180deg)` for dark mode. The code now maps colours in JavaScript because the filter was too slow in software-composited browsers. The CSS variable `--theme-filter` remains for some UI (for example library units).
- Evidence: `packages/excalidraw/renderer/interactiveScene.ts` L110-120 (comment and dark values), `css/theme.scss` L6 and L185 (`--theme-filter`), `components/LibraryUnit.scss` L60, L88.
- drawArc mapping: drawArc is dark-only (D-016), so do not invert the canvas. Lesson: never use `filter` on the React Flow pane for theming. Keep colours as tokens (ui-context).
- React Flow fit: native (React Flow `colorMode="dark"` for controls and handles; node colours via tokens).
- Priority: P4 (theme switch); P2 (performance lesson, avoid filters).
- Risks: none.

**F-56 Theme toggle shortcut (Alt+Shift+D) is host-gated** [HOSTED-capable]
- Observed: the toggle action is visible and bound to Alt+Shift+D only if the host enables `canvasActions.toggleTheme`. The hosted app enables it.
- Evidence: `actions/actionCanvas.tsx` L433-470 (`toggleTheme` label, keyTest L461-466, `UIOptions` predicate L467); `actions/shortcuts.ts` `toggleTheme: Shift+Alt+D`; `components/HelpDialog.tsx` (conditional row); `excalidraw-app/App.tsx` L966 **[HOSTED]** (`toggleTheme: true`).
- drawArc mapping: skip (dark-only). If ever needed, the host-gating pattern (a UI option per action) is worth copying for the F10 cheat sheet.
- React Flow fit: n/a.
- Priority: P4.
- Risks: none.

### 2.10 Accessibility and responsive

**F-57 Phone form factor: mobile menu, toolbar, and centred paste**
- Observed: when `formFactor === "phone"`, the editor renders a mobile menu, a mobile toolbar, and mobile shape actions; pastes land at viewport centre rather than the pointer; some desktop-only menu items (z-order) are removed.
- Evidence: `components/MobileMenu.tsx` L1-30 (imports `MobileShapeActions`, `MobileToolbar`, `PenModeButton`); `components/App.clipboard.ts` L192-196 (centre on non-desktop); `components/App.tsx` L11272-11280 (z-order only on desktop); `components/LayerUI.tsx` (mobile layout branches).
- drawArc mapping: F01 responsive shell. Keep drawArc's control bar at bottom with 768 px breakpoint (F10 FR-013). Do not add a separate mobile editor in MVP; use centre paste on small screens.
- React Flow fit: app UI; React Flow touch handles native.
- Priority: P3.
- Risks: touch-only users cannot use Alt or Shift; provide on-screen controls for every keyboard-only action that matters (duplicate, delete, undo).

**F-58 Touch and gestures (pinch, two-finger pan, pen mode)**
- Observed: pinch zoom and two-pointer pan are implemented; a pen mode button exists in the mobile toolbar; gestures are tracked by pointer count.
- Evidence: `components/App.tsx` L8069 (gesture centre), L8098 (pointer centre); `components/MobileMenu.tsx` `PenModeButton`.
- drawArc mapping: React Flow handles pinch and pan natively; pen mode: skip.
- React Flow fit: native.
- Priority: P4.
- Risks: none.

**F-59 Keyboard focus and ARIA on toolbar and actions**
- Observed: icon buttons carry `aria-label` (for example zoom buttons); tool buttons include shortcut text in their title; `aria-keyshortcuts` is set on a few buttons only (8 call sites in `packages/excalidraw` TSX); dialogs use `role="dialog"` with `aria-modal` in the colour picker.
- Evidence: `components/IconButton.tsx` L21, L170; `actions/actionCanvas.tsx` L166-170; `components/ColorPicker/Picker.tsx` L152; `components/Tools.tsx` L281-290.
- drawArc mapping: matches F10 NFR-006 in general. Gap to close in F10: `aria-keyshortcuts` on every control-bar button and on the context menu items (Excalidraw does this on some, not all).
- React Flow fit: app UI.
- Priority: P2.
- Risks: partial coverage in Excalidraw means it is not a model to copy wholesale.

**F-60 Reduced motion: only some CSS respects it; canvas animations do not**
- Observed: `prefers-reduced-motion` appears in two SCSS files (file-drop overlay, top-picks drag-and-drop). No TS or TSX file in `packages/excalidraw` references reduced motion. Viewport animations (scroll to content 500 ms, snap-back 250 ms, zoom and fit animations) run regardless.
- Evidence: `components/FileDropOverlay.scss` L140; `components/TopPicksDnD/TopPicksDnD.scss` L47; grep for `reducedMotion` / `prefers-reduced-motion` across `.ts`/`.tsx` returned no matches; `components/App.viewport.ts` L59-65 (durations).
- drawArc mapping: upgrade F10 FR-002: fit and zoom animations use duration 0 when the user prefers reduced motion (`matchMedia('(prefers-reduced-motion: reduce)')`). Small, testable, and above the Excalidraw baseline.
- React Flow fit: native (`fitView`/`zoomIn` duration parameter).
- Priority: P3.
- Risks: none.

**F-61 Focus return and dialog restore**
- Observed: not verified in this pass (the dialogs and focus traps were not traced in detail beyond `role` and `aria-modal`).
- Evidence: `components/ColorPicker/Picker.tsx` L152 only.
- drawArc mapping: F10 NFR-006 requires focus restore; keep Radix defaults.
- React Flow fit: app UI.
- Priority: P3.
- Risks: UNVERIFIED.

---

## Appendix A. Full shortcut table (Excalidraw)

Key: "Ctrl" means Ctrl (Windows/Linux) and Cmd (macOS). "Source" is the keyTest or shortcut-map entry. "drawArc" column: F = already in drawArc spec (feature ID), N = new candidate, S = skip, U = upgrade candidate.

| # | Action | Shortcut(s) | Source | drawArc |
|---|---|---|---|---|
| 1 | Selection tool | V, 1 | Tools.tsx L84 | N (palette key) |
| 2 | Hand tool | H | Tools.tsx L70-75 | S (React Flow pan) |
| 3 | Rectangle | R, 2 | Tools.tsx | N |
| 4 | Diamond | D, 3 | Tools.tsx | N |
| 5 | Ellipse | O, 4 | Tools.tsx | N |
| 6 | Arrow | A, 5 | Tools.tsx | N (edge tool, F09) |
| 7 | Line | L, 6 | Tools.tsx | S (edge type) |
| 8 | Freedraw | P or X, 7 | Tools.tsx | S |
| 9 | Text | T, 8 | Tools.tsx | N |
| 10 | Sticky note | N | Tools.tsx | N |
| 11 | Image | 9 | Tools.tsx | S (F19 later) |
| 12 | Eraser | E, 0 (toggle) | Tools.tsx L129-135 | S |
| 13 | Frame | F | Tools.tsx L76-78 | N (group, approval) |
| 14 | Laser pointer | K | Tools.tsx L118-120 | S |
| 15 | Bucket fill | B | Tools.tsx L152-154 | S |
| 16 | Autoshape (draw-to-shape) | Shift+X | Tools.tsx L140-143 | S |
| 17 | Tool lock | Q | App.tsx L5386 | N (F07 sticky) |
| 18 | Eyedropper | I; Shift+S; Shift+G | App.tsx L5606-5615 | S |
| 19 | Stroke popover | S (with selection or tool) | App.tsx L5541-5565 | S |
| 20 | Background popover | G (with selection or tool) | App.tsx L5541-5565 | S |
| 21 | Font popover | Shift+F | App.tsx ~L5570-5580 | S |
| 22 | Edit line/arrow points | Ctrl+Enter (help dialog) | HelpDialog.tsx | S |
| 23 | Edit text | Enter (help dialog) | HelpDialog.tsx | F08 (Enter edits label) |
| 24 | Text: new line | Enter / Shift+Enter (help dialog) | HelpDialog.tsx | F08 FR-007 (Shift+Enter in node) |
| 25 | Text: finish | Esc or Ctrl+Enter (help dialog) | HelpDialog.tsx | F08 FR-007 (Esc cancels, Enter commits) |
| 26 | Curved arrow (click sequence) | A then click x3 (help) | HelpDialog.tsx | S |
| 27 | Crop start / finish | double-click or Enter; Enter or Esc | HelpDialog.tsx | S |
| 28 | Prevent binding | Ctrl (hold while drawing) | HelpDialog.tsx | S |
| 29 | Hyperlink | Ctrl+K | actionLink.tsx L40 | N (P3) |
| 30 | Convert element type | Tab / Shift+Tab (help) | HelpDialog.tsx | S (keyTest not located) |
| 31 | Zoom in | Ctrl/Shift + = or + | actionCanvas.tsx L178-181 | F (F10 +/=) |
| 32 | Zoom out | Ctrl/Shift + - | actionCanvas.tsx L232-235 | F (F10 -) |
| 33 | Reset zoom to 100% | Ctrl/Shift + 0 | actionCanvas.tsx L290-293 | N (P3) |
| 34 | Zoom to fit all | Shift+1 | actionCanvas.tsx L425-427 | F (F10 shift+1) |
| 35 | Zoom to fit viewport selection | Shift+2 (keyTest; label mismatch with help) | actionCanvas.tsx L347-349 | U (F10) |
| 36 | Zoom to selection | Shift+3 (keyTest; label "zoom to selection") | actionCanvas.tsx L389-391 | U (F10) |
| 37 | Move page (wheel/keys) | PgUp/PgDn, Shift+PgUp/PgDn (help) | HelpDialog.tsx | S |
| 38 | Zen mode | Alt+Z | actionToggleZenMode.tsx L34 | S |
| 39 | Object snapping | Alt+S | actionToggleObjectsSnapMode.tsx L32 | N (P3) |
| 40 | Grid mode | Ctrl+' | actionToggleGridMode.tsx L33 | U (F06 snapToGrid) |
| 41 | View mode | Alt+R | actionToggleViewMode.tsx L34 | S (F12 viewer) |
| 42 | Toggle theme | Alt+Shift+D (host-gated) | actionCanvas.tsx L461-466 | S |
| 43 | Stats panel | Alt+/ | actionToggleStats.tsx L26-27 | N (P3, fold into panel) |
| 44 | Search menu | Ctrl+F | actionToggleSearchMenu.ts L57 | N (P2) |
| 45 | Command palette | Ctrl+/ or Ctrl+Shift+P (one key on Firefox) | shortcuts.ts | S (P4) |
| 46 | Shortcut cheat-sheet | ? | actionMenu.tsx L34 | F (F10 ?) |
| 47 | Clear canvas | Ctrl+Delete (confirm) | shortcuts.ts clearCanvas | S (or P3 with confirm) |
| 48 | Delete selection | Delete, Backspace | actionDeleteSelected.tsx L319-321 | F (F10 FR-005) |
| 49 | Cut | Ctrl+X | actionClipboard.tsx L127 | N (P1 with copy) |
| 50 | Copy | Ctrl+C | actionClipboard.tsx | N (P1) |
| 51 | Paste | Ctrl+V | App.clipboard.ts (onPasteShortcut) | N (P1) |
| 52 | Paste as plain text | Ctrl+Shift+V | help dialog (keyTest not located) | S (P3) |
| 53 | Copy as PNG | Shift+Alt+C | actionClipboard.tsx L256 | S (export F19) |
| 54 | Copy styles | Ctrl+Alt+C | actionStyles.ts L80-82 | N (P2) |
| 55 | Paste styles | Ctrl+Alt+V | actionStyles.ts L250-252 | N (P2) |
| 56 | Select all | Ctrl+A | actionSelectAll.ts L69 | F (F10 mod+a) |
| 57 | Multi-select (add) | Shift+click (help) / Ctrl+click (F10) | HelpDialog.tsx | F (F10 FR-008) |
| 58 | Deep select (inside group) | Ctrl+click (help) | HelpDialog.tsx | S (no groups yet) |
| 59 | Deep box select | Ctrl+drag (help) | HelpDialog.tsx | S |
| 60 | Duplicate (in place) | Ctrl+D | actionDuplicateSelection.tsx L118 | F (F10 mod+d, +20 offset) |
| 61 | Duplicate while dragging | Alt+drag | App.duplicate.ts L53 | N (P3) |
| 62 | Send backward | Ctrl+[ | actionZindex.tsx L37-40 | S (F10 z-order decision) |
| 63 | Bring forward | Ctrl+] | actionZindex.tsx L67-70 | S (F10 decision) |
| 64 | Send to back | Ctrl+Shift+[ (Win) / Ctrl+Alt+[ (Mac) | actionZindex.tsx L96-100 | S (F10 decision) |
| 65 | Bring to front | Ctrl+Shift+] (Win) / Ctrl+Alt+] (Mac) | actionZindex.tsx L134-137 | S (F10 decision) |
| 66 | Align top / bottom / left / right | Ctrl+Shift+Arrow | actionAlign.tsx L97-200 | N (P2) |
| 67 | Group | Ctrl+G | actionGroup.tsx L203-204 | N (approval) |
| 68 | Ungroup | Ctrl+Shift+G | actionGroup.tsx L307-310 | N (approval) |
| 69 | Lock / unlock elements | Ctrl+Shift+L | actionElementLock.ts L147-151 | N (P3) |
| 70 | Flip horizontal | Shift+H | actionFlip.ts L55 | S |
| 71 | Flip vertical | Shift+V | actionFlip.ts L80 | S |
| 72 | Wrap text toggle | W | actionToggleWrap.ts L12-15 | S (F08 wraps) |
| 73 | Font size down | Ctrl+Shift+< (or ,) | actionProperties.tsx L1118-1130 | N (P2 with F08 size) |
| 74 | Font size up | Ctrl+Shift+> (or .) | actionProperties.tsx L1141-1152 | N (P2) |
| 75 | Undo | Ctrl+Z | actionHistory.tsx L83-88 | F (F10 mod+z) |
| 76 | Redo | Ctrl+Shift+Z; Ctrl+Y (Windows) | actionHistory.tsx L126-130 | F (F10 mod+shift+z, mod+y) |
| 77 | Save | Ctrl+S | shortcuts.ts | S (F13 autosave) |
| 78 | Open | Ctrl+O | shortcuts.ts | S |
| 79 | Export image | Ctrl+Shift+E | shortcuts.ts | S (F19) |
| 80 | Finish / cancel in-progress element | Enter or Esc | actionFinalize.tsx L421-424 | F (Esc) |
| 81 | Deselect | Esc | actionDeselect.ts L131-134 | F (F10 Escape) |
| 82 | Pan | Space+drag, wheel+drag (help) | HelpDialog.tsx | F (React Flow pan) |
| 83 | Link to element (copy link) | (menu only in code) | actionElementLink.ts | S |

Notes on the table:
- Rows 19 to 21 and 18 are gated by selection or active tool; exact guard logic is in the cited App.tsx lines.
- Row 52 and row 30 keyTests were not located in the files read; the help dialog is the only source. Mark UNVERIFIED.
- Row 62 to 65 have macOS and Windows variants; both are shown.

---

## 3. Could not verify

- Live behaviour of every shortcut and menu item (no running app, no browser). Everything above is from source, not from clicking through it.
- Screenshots and visuals of the properties panel, colour picker, context menu, help dialog, zoom bar, and scroll-back button. No image under `dev-docs/` or `public/` was opened. Visual claims are UNVERIFIED.
- Whether a bare click (selection-only change) creates an undo entry in the running editor (F-03). Source suggests yes; not confirmed end-to-end.
- Mixed-value display in the properties panel when selected elements have different values (F-31). Predicates were read; rendering was not.
- Exact keyTest location for Tab / Shift+Tab (convert element type), Ctrl+Shift+V (paste as plain text), and Ctrl+Enter for line points. Help dialog rows only.
- Eyedropper UI and EyeDropper API support in the browsers drawArc targets (F-43).
- Dialog focus trap and focus restoration (F-61).
- Accessibility beyond attributes: screen reader output, live regions, and contrast of Excalidraw's own UI tokens were not checked.
- Hosted-only behaviour beyond the lines cited (cloud save, sharing, collaboration room mechanics). Only `excalidraw-app/App.tsx` L612, L749, L966 and `collab/Collab.tsx` L419 were read.
- React Flow v12 API names used in "React Flow fit" (`fitView`, `zoomIn`, `snapToGrid`, `colorMode`, edge `markerStart`/`markerEnd`, built-in edge types) come from prior knowledge of React Flow and were not re-checked against the v12 docs in this pass. Verify with the Context7 tool before writing F09/F10 specs.
- Whether drawArc's F06 already covers grid snap (F-53). Check F06 requirements before upgrading.
- Redo-clearing and undo-coalescing timing (how long a burst of edits becomes one step). The per-gesture rule is from `record`; the debounce or coalescing window was not located.

---

## 4. Top 10 recommendations for drawArc

1. **Copy and paste of nodes and edges (P1, new).** Clipboard JSON with id and edge endpoint remapping; paste at last pointer position on desktop, viewport centre on small screens (F-11). Highest productivity gap in the current specs.
2. **Keep selection and viewport out of undo (P1, upgrade F10 FR-003).** Document the undo set explicitly: node and edge data and positions only (F-02, F-03, F-06).
3. **Zoom to selection and zoom percentage readout (P2, upgrade F10 FR-001/FR-002).** One label per action, percentage readout that resets to 100% on click, and `fitView({ nodes })` for selection (F-49, F-50).
4. **Shortcut conflict test and shortcut-to-action registry (P2, upgrade F10 FR-004/FR-006).** One registry drives the cheat-sheet, context-menu hints, and `aria-keyshortcuts`; a unit test fails if two actions claim one key (F-15, F-16, F-18).
5. **Context menu upgrade (P2, upgrade F10 FR-009).** Per-item predicates (viewer hides mutating items), collapsed separators, `<kbd>` hints from the registry, pane paste once copy/paste exists (F-28, F-29).
6. **Edge style options (P2, upgrade F09).** Dashed and dotted stroke, stroke width presets, start and end arrow markers including crow's foot, and edge type (bezier, straight, step, smoothstep) mapped to React Flow built-ins (F-32 to F-35).
7. **Node properties panel: align, distribute, font size, text align, border style (P2, new feature with F08 upgrade).** Show controls per selected type using the Excalidraw predicate pattern; align and distribute write one undo entry (F-24, F-31, F-36, F-39).
8. **Colour picker upgrade (P2, upgrade F08 FR-011).** Hex input with contrast check (4.5:1 for node text, F08 NFR-006), recent or custom colours, `aria-label` with shortcut on swatches (F-41, F-44).
9. **Keyboard shape insertion and sticky palette tool (P2, new, tied to F07).** One letter per node type; Q-style lock that keeps the palette tool armed; Escape to cancel (F-20, F-21).
10. **Reduced motion and no canvas filters (P3, upgrade F10 FR-002).** Zero-duration fit and zoom when `prefers-reduced-motion` is set; never theme the React Flow pane with CSS `filter` (F-55, F-60).

Decisions for the owner (not recommendations): Ctrl+D offset (F-09), z-order and grouping (F-25, F-26), whether node colours are palette-only or arbitrary (F-41), and whether to add sketch styles at all (F-37, which this pass recommends skipping).
