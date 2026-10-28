# Research 01 · Selection, tools, transforms, text (excalidraw)

Scope: selection, shape tools, transforms, text. Output of a read-only research pass. No code was run, no installs, no commits.
Upstream snapshot: excalidraw/excalidraw commit `14bb42e` (2026-10-27), shallow clone in the session scratchpad.
Mapping targets: drawArc features F06, F07, F08, F09, F10, F11, F21 and `context/ui-context.md`.

Notation: paths are relative to the upstream repo root unless marked otherwise. Line numbers come from grep/sed reads of the snapshot.

## Sources inspected

Upstream (editor package `packages/excalidraw` unless noted; all open-source, none from `excalidraw-app/`):
- `packages/common/src/constants.ts` (lines 31-36, 143-160, 209-227, 263-296, 366, 552-590)
- `packages/common/src/keys.ts` (145-153: modifier helpers)
- `packages/element/src/collision.ts` (grep: hit threshold, frame name bounds, outline hit)
- `packages/element/src/selection.ts` (66-91: `getElementsWithinSelection`)
- `packages/element/src/bounds.ts` (grep: `BoxSelectionMode` contain/overlap at 1544-1790)
- `packages/element/src/transformHandles.ts` (49-54, 55, 142, 199-316)
- `packages/element/src/resizeElements.ts` (grep: rotate/resize call sites, 102-217, 431, 761)
- `packages/element/src/textElement.ts` (grep: bound text API, 97-117, 490-586)
- `packages/element/src/newElement.ts` (340-431, 546-571: text creation and autoResize)
- `packages/element/src/textWrapping.ts`, `textMeasurements.ts` (grep: wrap and measure API, line-height helpers)
- `packages/element/src/frame.ts` (grep: frame membership and default names, 1001-1006)
- `packages/element/src/sizeHelpers.ts` (61-73: `isInvisiblySmallElement`)
- `packages/excalidraw/components/App.tsx` (grep and reads: 504, 1559, 3631, 4573-4794, 5519, 6026, 6108-6116, 6219-6235, 9868-9880, 9956, 10049, 11117-11191)
- `packages/excalidraw/components/App.textTool.ts` (85-100, 335-350)
- `packages/excalidraw/components/App.modifiers.ts` (55-62)
- `packages/excalidraw/components/Tools.tsx` (44-135, 183-190, 240-300, 363-366)
- `packages/excalidraw/components/Toolbar.tsx` (127-179: shortcut hints)
- `packages/excalidraw/components/main-menu/DefaultItems.tsx` (448-480: box-selection preference)
- `packages/excalidraw/components/CommandPalette/CommandPalette.tsx` (grep only)
- `packages/excalidraw/actions/shortcuts.ts` (57, 117: tool lock key)
- `packages/excalidraw/actions/actionFlip.ts` (55, 80-82), `actionSelectAll.ts` (32-69), `actionToggleWrap.ts` (10-16), `actionTextAutoResize.ts` (23-32), `actionProperties.tsx` (1663-1676)
- `packages/excalidraw/wysiwyg/textWysiwyg.tsx` (887-930, 1093-1168: keyboard and blur semantics)
- `packages/excalidraw/lasso/utils.ts` (37-100), `lasso/index.ts` (imports only)
- `dev-docs/docs/` (grep only; no relevant page read)

drawArc (read-only):
- `context/ui-context.md` (81-97: interaction conventions)
- `features/README.md` (index table)
- `features/07-shapes-and-node-creation/01-requirements.md` (FR rows)
- `features/08-node-editing/01-requirements.md` (FR rows)
- `features/10-canvas-ergonomics-and-keyboard/01-requirements.md` (FR rows)

URLs: none fetched. No screenshots or images opened.

Hosted-only code: `excalidraw-app/` was not inspected. Nothing in this area was attributed to the hosted app.

## Summary of what the editor already does (read from code)

- Tools are a typed union: selection, lasso, rectangle, diamond, ellipse, arrow, line, freedraw, text, image, eraser, hand, frame, magicframe, stickynote, embeddable, laser, autoshape, bucketfill (`packages/common/src/constants.ts:552-572`, `packages/excalidraw/types.ts:152-171`).
- Every tool has a letter key and a numeric key (`Tools.tsx:78-135`). Tool lock is Q (`shortcuts.ts:117`).
- Box selection defaults to `"contain"` in `getElementsWithinSelection` (`selection.ts:72`). A user preference switches to `"overlap"` (`DefaultItems.tsx:448-480`). The stored appState default was not traced (UNVERIFIED).
- Resize and rotate modifiers: Shift = keep aspect ratio (`keys.ts:148`), Alt = resize from centre (`keys.ts:145`), Shift on rotate = 15-degree steps (`SHIFT_LOCKING_ANGLE = PI/12` in `packages/common/src/constants.ts:37`, `keys.ts:151`).
- Text is either bound to a container (label) or free. Bound text is never selected on its own (`lasso/utils.ts:63-66`).

## Findings

### A. Selection

#### S1 · Click select with pixel hit tolerance
- **Observed:** A click selects the topmost element whose outline (or filled interior) lies within a tolerance. The tolerance is `max(strokeWidth/2 + 0.1, 0.85 * DEFAULT_COLLISION_THRESHOLD / zoom)` in scene units. `DEFAULT_COLLISION_THRESHOLD = 2 * SIDE_RESIZING_THRESHOLD - EPSILON`, and `SIDE_RESIZING_THRESHOLD = 2 * DEFAULT_TRANSFORM_HANDLE_SPACING = 4`, so the threshold is about 8 px before the 0.85 factor (roughly 6.8 screen px). Frame names get a separate bound.
- **Evidence:** `App.tsx:6108-6116` (`getElementHitThreshold`), `App.tsx:5983-6040` (`getElementAtPosition`), `constants.ts:280-287`, `collision.ts:137-220`.
- **drawArc mapping:** Upgrade F06 (canvas base). React Flow already hit-tests node bodies and handles; no change needed. Keep as a reference for edge hit width (F09).
- **React Flow fit:** native (node body hit, `interactionWidth` on edges).
- **Priority:** P1.
- **Risks:** Edge hit width is a separate problem. Default React Flow edge `interactionWidth` may be too thin for touch (UNVERIFIED for the installed version).

#### S2 · Box select: contain vs overlap is a user preference
- **Observed:** Default box selection selects elements fully inside the rectangle (`contain`). A preference switches to `overlap`, which selects anything the rectangle touches.
- **Evidence:** `selection.ts:66-91` (default `"contain"`), `bounds.ts:1544, 1676-1686, 1784` (overlap branch), `DefaultItems.tsx:448-480` (preference UI).
- **drawArc mapping:** F10 FR-008 already fixes `selectionMode="partial"` (overlap). Upgrade F10 to optionally expose full/contain, or leave as is. Recommend keeping partial as the only mode for M1.
- **React Flow fit:** native (`selectionMode` = `partial` | `full`).
- **Priority:** P3.
- **Risks:** None for M1. A switch changes the one thing F10 already locked. Needs owner approval if added.

#### S3 · Lasso selection tool (path-based selection)
- **Observed:** The `lasso` tool draws a freeform trail. On release, elements are selected if the trail encloses them or crosses them, depending on mode. The path is simplified before testing. Bound text is ignored (its container decides). Locked elements are excluded. On phone form factor the lasso tool is the default instead of the rectangle selection (`App.tsx:3631`).
- **Evidence:** `packages/excalidraw/lasso/utils.ts:37-100` (`getLassoSelectedElementIds`, simplify, `enclosedElements` / `intersectedElements`, `selectableElements` filter), `App.tsx:731, 2504, 3631, 4573-4574`, `types.ts:439`.
- **drawArc mapping:** New feature (candidate F10 extension or new feature). Not in any current F-package.
- **React Flow fit:** custom interaction logic. React Flow has no lasso. Requires a pointer-path overlay plus node-rectangle intersection with polygon test. Keep node hit tests native.
- **Priority:** P3.
- **Risks:** Adds a tool mode to the canvas. Interaction conflicts with pan and box select. Needs owner approval as a new capability.

#### S4 · Select-all with lock exclusion
- **Observed:** Ctrl/Cmd+A selects all non-locked elements and, when selecting a single container, can select its bound text. Locked elements stay unselected.
- **Evidence:** `actionSelectAll.ts:32-69` (`!element.locked` filter), `actionSelectAll.ts:69` (keyTest `CtrlOrCmd+A`).
- **drawArc mapping:** Already specified as F10 FR-006 (`mod+a`) and FR-009 (pane menu). No change. Lock does not exist in drawArc.
- **React Flow fit:** native (`selectAll` via store, or `nodes.map`).
- **Priority:** P1.
- **Risks:** Must not select collaborators' nodes in read-only viewer mode (F10 FR-011 covers it).

#### S5 · Frame membership and frame-scoped selection
- **Observed:** A frame is a labelled container. Elements dropped into it become children and are clipped to it. The frame's default name is "Frame" (AI variant "AI Frame"). Box selection has an `excludeElementsInFrames` flag whose comment says it is effectively unused, so frame-child selection behaviour is not confirmed (UNVERIFIED).
- **Evidence:** `packages/element/src/frame.ts` (grep: `getElementsCompletelyInFrame` 110, `getElementsIntersectingFrame` 143, `addElementsToFrame` 570, `removeElementsFromFrame` 663, `isElementInFrame` 843, `getDefaultFrameName` 1001-1006), `selection.ts:70-71` (flag comment), `toolbar` frame button `Toolbar.tsx` near key F.
- **drawArc mapping:** New feature. A "group / container" concept would need schema work in `context/domain-model.md` (canvas schema v1). Not for M1.
- **React Flow fit:** needs architectural approval. React Flow supports `parentId` and `extent: 'parent'`, which is a different model (sub-flow nodes). Native-ish.
- **Priority:** P3.
- **Risks:** Schema change to canvas v1; sub-flow membership affects F06 sync and F13 persistence. Owner decision needed.

#### S6 · Groups
- **Observed:** Not traced. A `groups.ts` module exists in `packages/element/src/` and grouping actions exist (`actionGroup.tsx`), but group selection behaviour on click and drag was not read.
- **Evidence:** file list only (`packages/element/src/groups.ts`, `packages/excalidraw/actions/actionGroup.tsx`).
- **drawArc mapping:** Skip for M1. Revisit with frames (S5).
- **React Flow fit:** sub-flow / custom.
- **Priority:** P4.
- **Risks:** UNVERIFIED, see "Could not verify".

#### S7 · Multi-element selection bounding box with combined handles
- **Observed:** When several elements are selected, a union bounding box shows the same eight handles and a rotation handle. Dragging a handle resizes the whole selection; a separate multi-rotate path exists (`rotateMultipleElements`).
- **Evidence:** `transformHandles.ts:272-316` (`getTransformHandles`), `resizeElements.ts:166` (multi-element branch), `resizeElements.ts:431` (`rotateMultipleElements`).
- **drawArc mapping:** Upgrade F08 (resize) or new feature. F08 resizes one node at a time through `NodeResizer`.
- **React Flow fit:** custom interaction logic. `NodeResizer` is per node; a group resizer must compute new positions and sizes for all selected nodes and emit `NodeDimensionChange` and `NodePositionChange` through the F06 hook. Needs F06 hook change.
- **Priority:** P2.
- **Risks:** One gesture must yield one undo entry (F08 FR-004 already requires this). Liveblocks batch writes. Needs owner approval.

#### S8 · Selection handle size by pointer type
- **Observed:** Handle hit size is 8 px for mouse, 16 px for pen, 28 px for touch. Rotation handle sits 16 px (zoom-scaled) above the box. Side handles are hidden when a dimension is too small for eight handles.
- **Evidence:** `transformHandles.ts:49-54` (`transformHandleSizes`), `transformHandles.ts:55` (`ROTATION_RESIZE_HANDLE_GAP = 16`), `transformHandles.ts:142`, `transformHandles.ts:218-244`.
- **drawArc mapping:** F08 FR-005 already uses 8 px. Upgrade F08 (or F10 for touch) to use larger hit areas on coarse pointers.
- **React Flow fit:** native `NodeResizer` with `handleStyle`; touch hit area can be enlarged with a transparent pseudo-element.
- **Priority:** P3 (phone usage).
- **Risks:** None for desktop-only M1.

#### S9 · Selection visuals and hit state
- **Observed:** Selected elements get a dashed or solid bounding box in the accent colour. Handles are drawn on top of the box. Hover and selected states are distinct.
- **Evidence:** `App.tsx` render path not read in detail (UNVERIFIED for exact colours and dash pattern). Handle sizes from `transformHandles.ts` (see S8).
- **drawArc mapping:** F08 FR-005 and F07 FR-009 already specify the selected border (`--accent-primary` 2 px). No change.
- **React Flow fit:** native (`.selected` class).
- **Priority:** P4.
- **Risks:** None.

### B. Shape tools

#### T1 · Single-key tool shortcuts (letter and number per tool)
- **Observed:** Numeric keys 1-0 and letters switch tools: 1 selection, 2 rectangle (R), 3 diamond (D), 4 ellipse (O), 5 arrow (A), 6 line (L), 7 freedraw (P or X), 8 text (T), 9 is bound to a toolbar button that was not traced to a specific tool (UNVERIFIED, likely image), 0 eraser (E). The shortcut is shown in tooltips and aria-keyshortcuts. Other letter keys (F, K, B, N) are used by frame, autoshape, bucket fill and sticky note.
- **Evidence:** `Tools.tsx:78-135` (`letterKey` and `numericKey` per tool), `Tools.tsx:183-190` (`getToolShortcut`), `Toolbar.tsx:127-179`.
- **drawArc mapping:** New keyboard affordance under F10 (keyboard). In drawArc F07 the palette is the only creation path. Upgrade F07 with keys `1-6` or letter keys, placed in F10's keymap.
- **React Flow fit:** app UI (window `keydown` listener already specified in F10 FR-004).
- **Priority:** P2.
- **Risks:** Must respect F10 FR-004's ignore rules (inputs, dialogs, IME). Letter keys conflict with future shortcuts. Node creation via key must follow F07 FR-007 (centre of visible viewport).

#### T2 · Tool lock (Q) and tool stickiness
- **Observed:** Q toggles a locked tool so the same tool stays active after each creation. The lock is persisted as a user preference (`activeTool.locked`). A host can force a tool (`props.activeTool`).
- **Evidence:** `shortcuts.ts:57, 117`, `App.tsx:1041-1048, 3036, 4775-4794`.
- **drawArc mapping:** Skip for M1. F07 creation is drag-from-palette per drop; "keep palette active" is a different product decision.
- **React Flow fit:** app UI.
- **Priority:** P4.
- **Risks:** None if skipped.

#### T3 · Click-to-create vs drag-to-create (shapes)
- **Observed:** For rectangles, diamonds, ellipses, lines, arrows and similar, a pointer-down and pointer-up under the drag threshold (10 px, `DRAGGING_THRESHOLD`) creates nothing. The too-small element is removed (`isInvisiblySmallElement`). Sticky notes are the exception: a click creates a default-size note.
- **Evidence:** `constants.ts:31` (`DRAGGING_THRESHOLD = 10`), `sizeHelpers.ts:61-73`, `App.tsx:9956`, `App.tsx:10049`, `App.tsx:9868-9880` (sticky click branch).
- **drawArc mapping:** Contrast with F07 FR-007 (click on palette creates at viewport centre). drawArc intentionally differs. Skip this behaviour; keep F07.
- **React Flow fit:** app UI.
- **Priority:** P4.
- **Risks:** None. Noting for the owner that drawArc's model is intentionally different.

#### T4 · Shift-constrained aspect ratio (draw and resize)
- **Observed:** Holding Shift while drawing or resizing keeps the aspect ratio. Shift also constrains line and arrow angles to 15-degree steps.
- **Evidence:** `keys.ts:148-149` (`shouldMaintainAspectRatio = event.shiftKey`), `App.tsx:11117, 11190-11191` (resize branch), `packages/element/src/linearElementEditor.ts:336-381` (angle lock), `constants` `SHIFT_LOCKING_ANGLE = PI/12`.
- **drawArc mapping:** Upgrade F08 (resize). F08 FR-001 only sets `keepAspectRatio` for circle. Add Shift-held keep-aspect for all shapes during resize. Creation through F07 is not affected.
- **React Flow fit:** native prop `keepAspectRatio` on `NodeResizer`; Shift state needs a small window key listener that sets the prop, which is extra interaction logic.
- **Priority:** P2.
- **Risks:** Shift is already used by F10 (`selectionKeyCode="Shift"`) for box select. Conflict: holding Shift on a node resize versus box select. Resolve by only applying Shift-resize while a resize handle is active (owner decision, small).

#### T5 · Alt-to-resize-from-centre
- **Observed:** Holding Alt while resizing or drawing grows the shape symmetrically from its centre.
- **Evidence:** `keys.ts:145-146` (`shouldResizeFromCenter = event.altKey`), `resizeElements.ts` (centre branch, used at call sites near 102-210).
- **drawArc mapping:** New enhancement to F08. Low value for labelled rectangles.
- **React Flow fit:** custom interaction logic. On each `NodeDimensionChange` also emit a `NodePositionChange` shifting the origin by half the delta.
- **Priority:** P3.
- **Risks:** Each emitted change becomes a Liveblocks write. Must be one undo step (F08 FR-004).

#### T6 · Standalone text (text tool) with auto-width and fixed-width drag
- **Observed:** Clicking empty canvas with the text tool creates auto-width text (`autoResize` defaults to true). Dragging past the autowrap threshold creates fixed-width text at the drag origin (`autoResize` set to false, width from the drag). Clicking the centre of an empty container binds the text as its label.
- **Evidence:** `App.textTool.ts:85-100` (centre-click binding, drag to free text), `App.textTool.ts:335-350` (`handlePointerMove`), `newElement.ts:384` (`autoResize: opts.autoResize ?? true`), `newElement.ts:546-571` (switch to fixed width on wrap).
- **drawArc mapping:** New feature. The drawArc context says "no standalone text yet". A standalone text node would be a seventh node type. Candidate for a later feature, not F07-F08.
- **React Flow fit:** custom node type (`type: 'textNode'`), extra domain change. Needs architectural approval because `context/domain-model.md` is canvas schema v1 with six shapes.
- **Priority:** P2 (product decision; owner must confirm there is a need).
- **Risks:** Schema change touches F06 sync, F13 persistence and F14 templates. Measurement for auto-width (see X9).

#### T7 · Image, embeddable and laser tools
- **Observed:** Image tool inserts a file; embeddable tool places an iframe-like element; laser is a presence-style pointer that does not create elements. Laser is excluded from the active selection path (`App.tsx:1559`). Exact per-tool click behaviour was not traced for image and embeddable (UNVERIFIED).
- **Evidence:** `types.ts:162-169`, `types.ts:104` (`tool: "pointer" | "laser"`), `App.tsx:1559`, `App.tsx:10534` (image toolbar click), `packages/element/src/embeddable.ts` (file present).
- **drawArc mapping:** Skip image and embeddable (out of scope; F19 import/export and F20 share links are the closer homes). Laser: upgrade F11 presence as a transient pointer trail, P4.
- **React Flow fit:** app UI (laser), server (image upload, needs Vercel Blob design already in the project), skip embeddable.
- **Priority:** P4 (laser), skip (image, embed).
- **Risks:** Image upload needs storage decisions; out of scope for current milestones.

#### T8 · Eraser
- **Observed:** Eraser tool (E) removes elements under the stroke.
- **Evidence:** `Tools.tsx:131` (`letterKey: E`, `numericKey: 0`), `appState.ts:339` (`isEraserActive` helper).
- **drawArc mapping:** Skip. Delete (F10 FR-005) covers drawArc.
- **React Flow fit:** app UI.
- **Priority:** P4.
- **Risks:** None.

#### T9 · Frame tool (F) and magic frame
- **Observed:** The frame tool creates a labelled container (default name "Frame") and drops elements into it on creation. The magic frame variant is AI-driven and shows a different default name ("AI Frame").
- **Evidence:** `Tools.tsx` (frame tool, `Toolbar.tsx:138` shortcut F), `frame.ts:1001-1006`, `types.ts:165-166`.
- **drawArc mapping:** New feature, grouped with S5. AI variant overlaps F17 (AI design agent), but magic frame behaviour was not read (UNVERIFIED).
- **React Flow fit:** sub-flow (`parentId`), needs architectural approval.
- **Priority:** P3.
- **Risks:** Same schema concerns as S5.

#### T10 · Sticky note tool (N)
- **Observed:** A sticky note is a filled square text container. A click creates a default-size note (250 px) centred on the grid point under the pointer. Minimum size 75 px. Minimum font 16 px. Dragging sizes it.
- **Evidence:** `constants.ts:263-266` (`DEFAULT_STICKY_NOTE_SIZE = 250`, `STICKY_NOTE_MIN_SIZE = 75`), `constants.ts:227` (`STICKY_NOTE_MIN_FONT_SIZE = 16`), `App.tsx:9868-9880` (click branch), `Tools.tsx` (N shortcut), `packages/element/src/stickyNote.ts`.
- **drawArc mapping:** New node variant under F07 (a seventh shape) or a style of the rectangle. Note for owner; not in the six-shape list.
- **React Flow fit:** custom node (new `shape` value in `NODE_SHAPES`) — needs F07 spec change.
- **Priority:** P3.
- **Risks:** Canvas schema v1 change if added as a shape.

#### T11 · Autoshape (K) and bucket fill (B)
- **Observed:** Autoshape is a tool that converts a freehand stroke into a shape (exact behaviour not read; UNVERIFIED). Bucket fill (B) fills an enclosed region.
- **Evidence:** `constants.ts:552-572` (`autoshape`, `bucketfill`), `Toolbar.tsx:157` (K shortcut), `Toolbar.tsx:179` (B shortcut), `App.bucketFill.ts`, `packages/element/src/bucketFill.ts`.
- **drawArc mapping:** Skip. Freehand is F21; autoshape would need recognition logic.
- **React Flow fit:** custom, heavy.
- **Priority:** P4.
- **Risks:** Large; out of scope.

### C. Transforms

#### R1 · Flip horizontal and vertical (Shift+H, Shift+V)
- **Observed:** Shift+H flips the selection horizontally, Shift+V vertically. Flipping mirrors geometry; text is not mirrored (UNVERIFIED for text content).
- **Evidence:** `actionFlip.ts:55` (`keyTest: shiftKey && code H`), `actionFlip.ts:80-82` (`shiftKey && code V && !CtrlOrCmd`).
- **drawArc mapping:** Skip. A flipped labelled rectangle has no useful meaning in drawArc. Edges (F09) already route by handle position.
- **React Flow fit:** not applicable.
- **Priority:** P4.
- **Risks:** None.

#### R2 · Rotation handle with 15-degree Shift snapping
- **Observed:** A rotation handle sits above the selection box. Shift snaps rotation to 15-degree steps (`SHIFT_LOCKING_ANGLE = PI/12`, `shouldRotateWithDiscreteAngle = shiftKey`).
- **Evidence:** `transformHandles.ts:55, 76, 199-207`, `resizeElements.ts:102-121, 166, 217, 431`, `keys.ts:151-153`, `constants` `SHIFT_LOCKING_ANGLE`.
- **drawArc mapping:** Skip for M1. drawArc nodes are unrotated; rotating labelled nodes changes edge routing and label readability. Revisit only with an owner decision.
- **React Flow fit:** custom (would need node `rotation` in schema and edge recalculation).
- **Priority:** P4.
- **Risks:** Schema and edge-routing impact.

#### R3 · Minimum sizes
- **Observed:** Elements have a minimum of 1 unit (`MIN_WIDTH_OR_HEIGHT = 1`) and sticky notes have 75 px. Text has a minimum font size of 1 (`MIN_FONT_SIZE`).
- **Evidence:** `constants.ts:225, 266, 589`, `resizeElements.ts:315` (font clamp).
- **drawArc mapping:** Already covered: F08 FR-003 sets 48 x 32. Keep F08 values.
- **React Flow fit:** native (`minWidth` / `minHeight` on `NodeResizer`).
- **Priority:** P4.
- **Risks:** None.

#### R4 · Auto-grow text container to fit label
- **Observed:** Bound text in a container resizes the container when it grows (`handleBindTextResize`), and the container is recomputed from text dimensions (`computeContainerDimensionForBoundText`). The bound text max width and height are derived from the container.
- **Evidence:** `textElement.ts:164-200` (`handleBindTextResize`), `textElement.ts:536-555` (`computeContainerDimensionForBoundText`), `textElement.ts:555-600` (`getBoundTextMaxWidth` / `MaxHeight`).
- **drawArc mapping:** Upgrade F08 (node label). Today F08 FR-014 clamps labels to five lines and fixes node size. Option: grow node height to fit label (up to a cap) instead of clamping.
- **React Flow fit:** custom interaction logic plus measured node size (React Flow 12 exposes measured dimensions; reading them from the store is native; writing back the new height via the F06 hook is custom).
- **Priority:** P2.
- **Risks:** Needs text measurement or DOM measurement (X9). Changes F08 FR-014 and the `width/height` persistence contract. Owner approval needed.

#### R5 · Resize cursors
- **Observed:** Handles show directional resize cursors (`nwse-resize`, `ns-resize`, and so on) and the rotation handle shows a rotate cursor. Exact cursor names not read (UNVERIFIED).
- **Evidence:** `transformHandles.ts` (handle generation, cursor not read; UNVERIFIED); `App.cursor.ts` (file present, not read).
- **drawArc mapping:** Confirm F08 uses standard `cursor` values on `NodeResizer` (React Flow default). No change expected.
- **React Flow fit:** native.
- **Priority:** P4.
- **Risks:** None.

### D. Text

#### X1 · Double-click to edit text (container and standalone)
- **Observed:** Double-clicking an element opens a WYSIWYG textarea over the canvas. For a container, the label is edited in place. Editing opens with the existing text.
- **Evidence:** `App.tsx:5519` (`startTextEditing`), `App.tsx:4660` (`getContainerElement` on paste), `App.tsx:6219-6235` (double-click branch), `wysiwyg/textWysiwyg.tsx`.
- **drawArc mapping:** Already covered by F08 FR-006 (double-click or Enter opens the label editor). Confirmed as the same pattern.
- **React Flow fit:** app UI (textarea overlay), native node events.
- **Priority:** P1.
- **Risks:** Overlay must stop key propagation (F08 FR-008 already does).

#### X2 · Escape commits the text (not cancel)
- **Observed:** In the upstream WYSIWYG editor, Esc calls `handleSubmit()` with `submittedViaKeyboard = true`, so it commits. Blur also commits (`onblur = handleSubmit`, window blur handler).
- **Evidence:** `wysiwyg/textWysiwyg.tsx:887-890` (Esc to submit), `textWysiwyg.tsx:1093, 1151, 1168` (blur to submit).
- **drawArc mapping:** Divergence from F08 FR-007 (Esc cancels, restores pre-edit label). Keep F08 as specified; the owner should confirm this choice explicitly, since the reference editor does the opposite.
- **React Flow fit:** app UI.
- **Priority:** P2 (decision, no code).
- **Risks:** Users coming from excalidraw may expect Esc to keep text. Owner decision needed.

#### X3 · Enter inserts newline; Ctrl/Cmd+Enter commits
- **Observed:** Ctrl/Cmd+Enter submits the text (`textWysiwyg.tsx:899-905`). A plain Enter branch is not shown in the read range, so it is assumed to insert a newline (UNVERIFIED for plain Enter).
- **Evidence:** `textWysiwyg.tsx:899-905`.
- **drawArc mapping:** Divergence from F08 FR-007 (Enter commits, Shift+Enter newline). Keep F08; owner decision as X2.
- **React Flow fit:** app UI.
- **Priority:** P2 (decision).
- **Risks:** Muscle memory differs. Note that drawArc labels are short, so newline is rarely used.

#### X4 · Tab and Ctrl+[ / ] indent in text editor (4 spaces)
- **Observed:** Tab inserts 4 spaces; Shift+Tab or Ctrl+[ outdents; Ctrl+] indents.
- **Evidence:** `textWysiwyg.tsx:915-928` (`TAB_SIZE = 4`, `indent` / `outdent`).
- **drawArc mapping:** Skip. Labels are short. Tab should keep moving focus in the UI.
- **React Flow fit:** app UI.
- **Priority:** P4.
- **Risks:** Tab focus trap if implemented.

#### X5 · Wrap toggle (W) and auto-width vs fixed-width
- **Observed:** W toggles wrapping for selected elements (no Ctrl, Alt or Shift). Auto-width text does not wrap; wrapped text uses `wrapText` at the element width.
- **Evidence:** `actionToggleWrap.ts:10-16`, `textWrapping.ts:398` (`wrapText`), `textWrapping.ts:448` (`getWrappedTextLines`), `actionTextAutoResize.ts:23-32`.
- **drawArc mapping:** F08 already wraps via CSS with a five-line clamp (FR-014). A wrap/no-wrap toggle is a small enhancement, P3.
- **React Flow fit:** custom (node `data` field) — needs schema change.
- **Priority:** P3.
- **Risks:** Schema change to canvas v1 if a new field is added.

#### X6 · Vertical alignment inside containers (top, middle, bottom)
- **Observed:** Bound text can be aligned top, middle or bottom inside its container. Vertical alignment is allowed only for some containers (`shouldAllowVerticalAlign`).
- **Evidence:** `actionProperties.tsx:1663-1676` (`changeVerticalAlign`), `textElement.ts:490-505` (`shouldAllowVerticalAlign`).
- **drawArc mapping:** F08 FR-009 and FR-014 centre the label both ways. Vertical alignment is a new option (P3) that needs a node data field.
- **React Flow fit:** custom node data plus CSS `justify-content`.
- **Priority:** P3.
- **Risks:** Schema field; owner approval.

#### X7 · Horizontal alignment (left, centre, right)
- **Observed:** Text supports left, centre and right alignment. Default is left (`DEFAULT_TEXT_ALIGN = "left"`). Some container types do not support horizontal align (`suppportsHorizontalAlign`).
- **Evidence:** `constants.ts:277`, `textElement.ts:506-530` (`suppportsHorizontalAlign`).
- **drawArc mapping:** F08 centres labels. Alignment option is new, P3. Default for drawArc should stay centred.
- **React Flow fit:** custom node data plus CSS.
- **Priority:** P3.
- **Risks:** Schema field.

#### X8 · Font families
- **Observed:** Nine families are registered: Virgil (1), Helvetica (2), Cascadia (3), Excalifont (5, default), Nunito (6), Lilita One (7), Comic Shanns (8), Liberation Sans (9), Assistant (10). Each has a generic fallback chain (`sans-serif`, `monospace`).
- **Evidence:** `constants.ts:143-172` (`FONT_FAMILY`, fallbacks), `constants.ts:271` (`DEFAULT_FONT_FAMILY = Excalifont`).
- **drawArc mapping:** drawArc uses Geist Sans (F08 FR-014). Font picker is new and P4. Not recommended: the hand-drawn family does not fit the product's dark, clean theme.
- **React Flow fit:** custom node data plus font loading.
- **Priority:** P4.
- **Risks:** Font loading delays and measurement changes (X9).

#### X9 · Font size
- **Observed:** Default font size is 20; minimum 1 (`DEFAULT_FONT_SIZE`, `MIN_FONT_SIZE`). Sticky notes use 16 minimum.
- **Evidence:** `constants.ts:225-227`, `resizeElements.ts:315`.
- **drawArc mapping:** F08 fixes 14 px (FR-014). Per-node size is new, P3, and needs schema approval.
- **React Flow fit:** custom node data.
- **Priority:** P3.
- **Risks:** Font size interacts with auto-grow (R4).

#### X10 · Text measurement
- **Observed:** Text width and height come from a measurement function with a custom metrics provider hook (`setCustomTextMetricsProvider`). If measurement is unsupported, the editor shows a dedicated error component for Brave (`BraveMeasureTextError.tsx`). Element size is derived from measured text for bound containers.
- **Evidence:** `textMeasurements.ts:16-36` (`measureText`), `textMeasurements.ts:61-72` (`isMeasureTextSupported`), `textMeasurements.ts:134-186` (`setCustomTextMetricsProvider`), `components/BraveMeasureTextError.tsx` (file present, content not read).
- **drawArc mapping:** Matters only for R4 (auto-grow) and T6 (auto-width). F08's CSS wrap needs no measurement. Keep CSS wrap for M1.
- **React Flow fit:** DOM measurement (`measured` dimensions) is native and avoids canvas measurement.
- **Priority:** P2 (risk for R4 and T6, not a feature).
- **Risks:** Canvas measurement can fail under browser privacy modes. Use DOM measurement to avoid this.

#### X11 · Line height
- **Observed:** Each text element has a line height; the editor detects it (`detectLineHeight`) and computes px height (`getLineHeightInPx`). The default numeric value was not read (UNVERIFIED).
- **Evidence:** `textMeasurements.ts:88-107`, `textMeasurements.ts:107-133` (`getApproxMinLineHeight`).
- **drawArc mapping:** Skip. F08 fixes line height at 1.3 (FR-014).
- **React Flow fit:** CSS.
- **Priority:** P4.
- **Risks:** None.

## Could not verify

- **UNVERIFIED** Groups behaviour: click, drag and resize of grouped elements (`packages/element/src/groups.ts`, `actionGroup.tsx` not read).
- **UNVERIFIED** Whether box select excludes frame children by default (`excludeElementsInFrames` comment says the flag is effectively unused).
- **UNVERIFIED** Plain Enter behaviour in the text editor (only Ctrl/Cmd+Enter branch was read).
- **UNVERIFIED** Whether an empty bound or free text is deleted on blur (not traced).
- **UNVERIFIED** Exact default values for the appState box-selection mode and lasso mode preference (only the function default was read).
- **UNVERIFIED** Image and embeddable tool click behaviour (`App.tsx:10534` seen only as toolbar entry).
- **UNVERIFIED** Autoshape (K) and magic frame (AI) behaviour (only enum and key found).
- **UNVERIFIED** Resize cursor names and rotation cursor (`App.cursor.ts` not read).
- **UNVERIFIED** Line-height default value.
- **UNVERIFIED** Visual appearance of handles, selection box colours and dash patterns. No image or screenshot was opened.
- **UNVERIFIED** The public documentation at docs.excalidraw.com was not fetched; all findings are code-based.
- **UNVERIFIED** Hosted app (`excalidraw-app/`) behaviour for any item above was not inspected. Nothing here is attributed to the hosted app.
- **UNVERIFIED** React Flow 12 behaviour of `NodeResizer` `keepAspectRatio` at runtime and `selectionMode` naming against the installed version. The drawArc feature specs assume these names; not checked against `node_modules`.
- **UNVERIFIED** Touch and pen behaviour beyond the handle sizes.

## Top 10 recommendations for drawArc

1. **Shift keeps aspect ratio during node resize (T4, P2, F08 upgrade).** Small, matches a known convention. Resolve the Shift conflict with F10 box select by applying it only while a resize handle is active.
2. **Owner decision on text commit semantics (X2 and X3, P2).** The reference editor commits on Esc and treats Ctrl/Cmd+Enter as commit. F08 currently says Esc cancels and Enter commits. Keep F08 unless the owner decides otherwise, and record the choice in `context/decision-log.md`.
3. **Single-key shape creation through the F10 keymap (T1, P2, F07 + F10).** Keys 1-6 or R/D/O/A/L/T. Respect F10 FR-004 ignore rules.
4. **Multi-node resize and move with one undo step (S7, P2, F08 / F06 extension).** Needed for real diagrams. Requires owner approval because it changes the F06 hook contract.
5. **Auto-grow node height to fit the label, instead of clamping at five lines (R4, P2, F08 upgrade).** Use DOM-measured sizes (X10), not canvas measurement. Needs approval because it changes the width/height persistence contract.
6. **Standalone text as a seventh node type (T6, P2, new feature).** Only after the owner confirms there is a need. Schema v1 change.
7. **Keep F10 partial box select as the single mode; do not add a contain option now (S2, P3).** Lowers complexity; revisit with user feedback.
8. **Lasso selection (S3, P3, new feature).** Custom pointer path, node-polygon intersection. Defer until after M1.
9. **Alt-from-centre resize (T5, P3, F08 enhancement).** Cheap to add later on top of the F06 hook; low priority.
10. **Node text options (X6, X7, X9: vertical align, horizontal align, font size; P3).** Add as one schema change with a single approval, not three. Keep drawArc's centred default.

Skip list for the owner (P4, no action): rotation (R2), flip (R1), eraser (T8), image and embeddable (T7), autoshape and bucket fill (T11), font family picker (X8), tool lock (T2), indent (X4), line height (X11), click-to-create differences (T3).
