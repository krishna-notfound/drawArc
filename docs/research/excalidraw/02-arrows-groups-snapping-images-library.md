# Excalidraw research 02: arrows and binding, grouping/lock/z-order, snapping, images, libraries, clipboard

Upstream: excalidraw/excalidraw, commit 14bb42e (2026-10-27), shallow clone. All source paths are relative to the repo root. Everything here is read-only research; nothing was executed from the clone.

Status legend: **Editor** = `packages/*` (open source). **Hosted** = `excalidraw-app/` (excalidraw.com only). **UNVERIFIED** = not confirmed by reading source or docs.

## Sources inspected

Source files read (grep and targeted reads):
- `packages/element/src/binding.ts` (BASE_BINDING_GAP, getBindingGap, maxBindingDistance_simple, fixed points)
- `packages/element/src/elbowArrow.ts` (fixedSegments, corner radius)
- `packages/element/src/fractionalIndex.ts` (syncMovedIndices, syncInvalidIndices)
- `packages/element/src/groups.ts`, `zindex.ts`, `frame.ts`, `selection.ts`, `duplicate.ts`, `align.ts`, `distribute.ts`, `image.ts` (names only)
- `packages/excalidraw/snapping.ts` (SNAP_DISTANCE, isSnappingEnabled, getVisibleGaps)
- `packages/excalidraw/clipboard.ts` (parseClipboard, copy PNG, copy text)
- `packages/excalidraw/data/library.ts` (ALLOWED_LIBRARY_URLS, LibraryUpdate, library class)
- `packages/excalidraw/types.ts` (LibraryItem, BinaryFileData)
- `packages/excalidraw/components/App.tsx` (addElementsFromPasteOrLibrary, image insertion ~L10391-10475, imageOptions check ~L10430, lock check ~L1048)
- `packages/excalidraw/components/PublishLibrary.tsx` (submit to VITE_APP_LIBRARY_BACKEND/submit)
- `packages/excalidraw/actions/`: `actionZindex.tsx`, `actionGroup.tsx`, `actionAlign.tsx`, `actionDistribute.tsx`, `actionFrame.ts`, `actionElementLock.ts`, `actionProperties.tsx` (arrow type, roundness, arrowheads), `actionToggleArrowBinding.tsx`, `actionCropEditor.tsx`, `actionDuplicateSelection.tsx`, `actionClipboard.tsx` (names), `shortcuts.ts`
- `packages/excalidraw/components/App.arrowText.ts` (header only)
- `packages/common/src/constants.ts` (DEFAULT_GRID_SIZE, DEFAULT_GRID_STEP, IMAGE_MIME_TYPES, DEFAULT_IMAGE_OPTIONS, EXPORT_DATA_TYPES, ARROW_TYPE)
- `packages/excalidraw/appState.ts` (gridSize, objectsSnapModeEnabled defaults)
- `excalidraw-app/App.tsx` (library URL token handling near L572, publish near L1173)
- `dev-docs/docs/@excalidraw/excalidraw/` file list (api, customizing-styles, faq, integration; no arrows/snapping/library page found in this listing)

URLs read:
- https://libraries.excalidraw.com (WebFetch, summarised by a small model; treat as lightly verified)

Not opened: any screenshot or image under `dev-docs/docs/assets/` (only the file names were listed; none were opened, so no visual claim is made here). The live app was not opened.

Context read on the drawArc side: `context/ui-context.md`, `context/domain-model.md`, `features/README.md`, and `features/09`, `10`, `14` `01-requirements.md`.

## Corrections to the brief

- **Snapping toggle is Alt+S, not Shift.** `shortcuts.ts`: `objectsSnapMode: Alt+S`. Snapping defaults to off (`appState.ts` `objectsSnapModeEnabled: false`). Holding Ctrl/Cmd inverts snapping for the gesture (`snapping.ts` `isSnappingEnabled`); when grid mode is on, Ctrl/Cmd does not enable snapping.
- **Single selected arrow suppresses object snapping** (`snapping.ts`: "do not suggest snaps for an arrow to give way to binding").
- Editor-side image limits are 1440 px max side and 4 MB (`DEFAULT_IMAGE_OPTIONS`), overridable by the host.

## Findings: arrows and binding

### F-A01 Arrow types: sharp, round, elbow
- **Observed:** Three arrow types. Changing type to elbow converts the arrow to orthogonal routing; round sets roundness. Changing type recalculates points (`actionProperties.tsx` `actionChangeArrowType`, around L2077-2106).
- **Evidence:** `packages/common/src/constants.ts` `ARROW_TYPE` = {sharp, round, elbow}; `actionProperties.tsx` L2077-2106.
- **drawArc mapping:** Upgrade F09 (edge types). Smooth-step is already the only edge; round/curved is a `type` option.
- **React Flow fit:** native (`getBezierPath`, `getSmoothStepPath`, `getStraightPath`) for sharp/round. Elbow with user-owned fixed segments = custom edge component.
- **Priority:** P2.
- **Risks:** Elbow routing with fixed segments is complex (see F-A05); adds a schema field to canvas v1 (needs approval per domain-model rules).

### F-A02 Arrow roundness (sharp vs round, two radius algorithms)
- **Observed:** Roundness toggles between sharp and round. Round uses a proportional radius (0.25 × size) for lines, or an adaptive radius (fixed 32 px) for elbow arrows. A "Change edge roundness" action exists.
- **Evidence:** `actionProperties.tsx` `actionChangeRoundness` L1764-1831; `constants.ts` DEFAULT_PROPORTIONAL_RADIUS 0.25, DEFAULT_ADAPTIVE_RADIUS 32.
- **drawArc mapping:** Upgrade F09 (edge style). Fold into the same edge-style control as F-A01.
- **React Flow fit:** native via `borderRadius` on smooth-step; corners on elbow = custom edge.
- **Priority:** P3.
- **Risks:** Two algorithms in one product means two visual rules; pick one for drawArc.

### F-A03 Arrowheads: start/end with nine kinds
- **Observed:** Start and end arrowheads each choose one of: none, arrow, triangle, triangle outline, circle, circle outline, diamond, diamond outline, bar. Keyboard shortcuts Q W E R A S D F Z map to these kinds in the properties panel.
- **Evidence:** `actionProperties.tsx` ~L1850-1910 (labels `arrowhead_*`, values `arrow`, `triangle`, `triangle_outline`, `circle`, `circle_outline`, `diamond`, `diamond_outline`, `bar`).
- **drawArc mapping:** Upgrade F09. Current F09 uses a closed arrow at target only (ui-context). Add start marker and a small set of marker kinds.
- **React Flow fit:** native. `markerStart` and `markerEnd` accept `EdgeMarker` (type `Arrow` / `ArrowClosed`, color, size). Circle, diamond and bar are not built-in; custom SVG `<marker>` defs needed.
- **Priority:** P2.
- **Risks:** Marker kinds beyond arrow need custom `<defs>`; keep marker set small.

### F-A04 Multi-point lines and point editing
- **Observed:** Lines and arrows have multiple points. Points are edited by dragging; double-click or key adds a point on the segment; duplicate of selected point is supported (`LinearElementEditor.duplicateSelectedPoints`, called from `actionDuplicateSelection`). Elbow arrows cannot have manual midpoints added between start and end (error text in source).
- **Evidence:** `packages/element/src/linearElementEditor.ts` (2881 lines, not fully read); `actionDuplicateSelection.tsx` L43-47; `elbowArrow.ts` L914 error message.
- **drawArc mapping:** New feature (no F09 coverage; F09 edges are single-segment smooth-step). Could be a P3 "waypoint" feature.
- **React Flow fit:** custom edge + extra interaction logic. React Flow has no native waypoint editing for edges.
- **Priority:** P3.
- **Risks:** Waypoints in Liveblocks storage and in canvas schema v1 need approval; collision with the four-handle constraint.

### F-A05 Fixed binding points on elbow arrows (fixedSegments)
- **Observed:** Elbow arrows keep user-set segments (`fixedSegments`) when the shapes move; the routing keeps the fixed segment and adjusts neighbours. Bindings to a fixed point use `calculateFixedPointForElbowArrowBinding` and `getGlobalFixedPoints`.
- **Evidence:** `packages/element/src/elbowArrow.ts` L123-155; `binding.ts` L2256 (`calculateFixedPointForElbowArrowBinding`), L2813 (`getGlobalFixedPoints`), L2853 (`getArrowLocalFixedPoints`).
- **drawArc mapping:** New feature or part of an elbow-edge feature after F09. Not in current specs.
- **React Flow fit:** custom edge. Would need a custom router; React Flow does not route edges around nodes.
- **Priority:** P3.
- **Risks:** Routing and collision logic is large; high defect risk.

### F-A06 Binding to shapes: hit area and binding gap
- **Observed:** An arrow end binds when the pointer is within a binding distance of a bindable shape's outline. The arrow stops at a gap from the outline: `BASE_BINDING_GAP` 5 px plus half the stroke width. Binding distance is about 15 px and up to 30 px, depending on zoom (clamped).
- **Evidence:** `packages/element/src/binding.ts` L119-146 (`BASE_BINDING_GAP = 5`, `getBindingGap`, `maxBindingDistance_simple` with clamp between 15 and 30).
- **drawArc mapping:** Upgrade F09 (connections). F09 handle-based connection is a different model: drawArc binds to four fixed handles; Excalidraw binds to any outline point. Keep the handle model; the gap idea is only useful if drawArc ever allows free endpoints.
- **React Flow fit:** not applicable to free-endpoint binding; React Flow connects handles.
- **Priority:** P4 for free binding; the gap concept is informational.
- **Risks:** Free binding conflicts with the four-handle canvas schema v1.

### F-A07 Suggested-binding highlight while dragging
- **Observed:** While dragging an arrow end near a shape, the candidate shape is highlighted (suggested binding), drawn in the interactive layer per shape type (`suggestedBinding` in app state; rendered in `interactiveScene.ts` ~L260-291).
- **Evidence:** `packages/excalidraw/renderer/interactiveScene.ts` L260-291; `binding.ts` `getHoveredElementForBinding`-style helpers (grep only).
- **drawArc mapping:** Upgrade F09 connection gesture: highlight the target node when a connection drag hovers it, not just the handle. React Flow already shows `.connecting`/`.valid` classes on handles; a node-level highlight is custom CSS plus a `connectionState`.
- **React Flow fit:** native-ish via `useConnection` state; node highlight = custom node styling.
- **Priority:** P2.
- **Risks:** Low; purely visual.

### F-A08 Rebinding and updating arrows when shapes move
- **Observed:** Moving a bound shape updates bound arrow endpoints (`updateBoundElements`, `updateBoundArrow`, `updateBindings`). Arrow endpoints re-anchor to the outline on move. Binding is removed when a shape is deleted (`fixBindingsAfterDeletion`).
- **Evidence:** `binding.ts` L1422 (`updateBoundArrow`), L1499 (`updateBoundElements`), L1620 (`updateBindings`), L2447 (`fixBindingsAfterDeletion`).
- **drawArc mapping:** Already native in React Flow for handle edges (edges follow nodes). Upgrade F09 only for the "delete node removes edges" rule (already FR-009).
- **React Flow fit:** native.
- **Priority:** P4 (already covered).
- **Risks:** None for drawArc.

### F-A09 Unbinding by dragging away or toggling binding
- **Observed:** Dragging an end away from a shape unbinds it. A menu item "arrow binding" toggles whether arrows bind at all (`isBindingEnabled` in app state); no keyboard shortcut was found for it.
- **Evidence:** `actionToggleArrowBinding.tsx` (no `keyTest`, menu-only); `binding.ts` L147-150 (`isBindingEnabled`), L702 and L1009 guards.
- **drawArc mapping:** Skip. drawArc always binds to handles; a binding-off mode adds no value.
- **React Flow fit:** not needed.
- **Priority:** P4.
- **Risks:** None.

### F-A10 Arrow labels as container text (bound text on arrows)
- **Observed:** Arrows can carry bound text placed at the midpoint; text is part of the arrow and moves with it. Editing text on an arrow goes through `App.arrowText.ts` (`getTextBindingForArrowEndpoint`, `hitElementBoundText`, `getEndpointBoundTextDragAnchor`).
- **Evidence:** `packages/excalidraw/components/App.arrowText.ts` (header and imports); `packages/element/src/arrowEndpointText.ts` L73 (locked check).
- **drawArc mapping:** Upgrade F09 FR-006/FR-007 (label on edges). drawArc already has edge labels with a pill; Excalidraw's label is free text inside the arrow. Current design (pill in EdgeLabelRenderer) is simpler and fine.
- **React Flow fit:** native via `EdgeLabelRenderer` (already used by F09).
- **Priority:** P3 (only multi-line label is new).
- **Risks:** Keep the pill; no change needed unless multi-line labels are wanted.

## Findings: grouping, lock, z-order, frames

### F-G01 Group and ungroup
- **Observed:** Ctrl/Cmd+G groups the selection; Ctrl/Cmd+Shift+G ungroups. Groups are an ordered list of group ids per element. Nested groups are supported (`getMaximumGroups` counts depth).
- **Evidence:** `shortcuts.ts` L93-94; `actionGroup.tsx` keyTest L203-206 and L307-310; `packages/element/src/groups.ts` L162 (`addToGroup`), L183 (`getMaximumGroups`), L248 (`getNewGroupIdsForDuplication`).
- **drawArc mapping:** New feature (no group in current specs; ui-context says no groups yet). Candidate for P1/P2 on canvas.
- **React Flow fit:** native via sub-flows (`parentId`, `extent: 'parent'`) for one level. True nested or multi-group membership is custom logic (React Flow has no multi-group).
- **Priority:** P2.
- **Risks:** Sub-flow `parentId` changes node coordinates and ordering; Liveblocks sync of parent changes needs care. Requires approval for schema change.

### F-G02 Selecting into a group (click selects whole group; enter group to pick one element)
- **Observed:** A click on a grouped element selects the whole group. Editing into a group (`editGroupForSelectedElement`) lets one element be selected inside it. Exact double-click mapping is UNVERIFIED (the canvas handler `handleCanvasDoubleClick` exists at App.tsx ~L2723; the group branch was not read).
- **Evidence:** `packages/element/src/groups.ts` L20 (`selectGroup`), L123 (`editGroupForSelectedElement`), L66-94 (`isSelectedViaGroup`, `selectGroupsFromGivenElements`).
- **drawArc mapping:** Part of F-G01.
- **React Flow fit:** custom interaction logic.
- **Priority:** P2 (with F-G01).
- **Risks:** Double-click behaviour conflicts with F08 label editing (double-click edits label). Needs a decision.

### F-G03 Group move and resize
- **Observed:** Moving or resizing a group moves or resizes all members together; the group behaves as one selection.
- **Evidence:** `packages/element/src/groups.ts` `selectGroupsFromGivenElements`; resize handled in the transform code (not read in detail).
- **drawArc mapping:** Part of F-G01.
- **React Flow fit:** native for sub-flow children moving with parent; resize of parent needs custom logic.
- **Priority:** P2.
- **Risks:** Resize-as-group is not native in React Flow for multiple nodes; plan custom.

### F-G04 Lock and unlock elements
- **Observed:** Ctrl/Cmd+Shift+L toggles lock on selected elements. Locked elements are excluded from selection (`shouldIgnoreElementFromSelection`), cannot be moved, and can still be selected through the context menu to unlock. A menu item unlocks all.
- **Evidence:** `shortcuts.ts` L104 (`toggleElementLock`); `actionElementLock.ts` L23, L147-151 (keyTest), L161 (`unlockAllElements`); `packages/element/src/selection.ts` L29-30; `App.selection.ts` L508 (context menu can select locked).
- **drawArc mapping:** New feature (ui-context lists no lock). Candidate P2 for "diagram background" use.
- **React Flow fit:** native via `nodesDraggable={false}` per node plus `selectable={false}`; a per-node `data.locked` flag is the simplest. Synced through node data (Liveblocks).
- **Priority:** P2.
- **Risks:** Locked node must still allow delete per product choice; permissions for viewers already handled.

### F-G05 Z-order commands (bring forward, backward, to front, to back)
- **Observed:** Ctrl/Cmd+] brings forward; Ctrl/Cmd+[ sends backward. To front and to back use Ctrl/Cmd+Shift+] and Ctrl/Cmd+Shift+[ on Windows and Linux; on macOS they are Ctrl/Cmd+Alt+] and Ctrl/Cmd+Alt+[. These are menu and keyboard commands.
- **Evidence:** `shortcuts.ts` L80-90; `actionZindex.tsx` keyTests L37-41, L67-70, L96-103, L134-140; `packages/element/src/zindex.ts` L626-660 (`moveOneLeft`, `moveOneRight`, `moveAllLeft`, `moveAllRight`).
- **drawArc mapping:** Upgrade F10 (keyboard, context menu) with z-order, but only after `zIndex` is synced (ui-context says `zIndex` is not synced by `@liveblocks/react-flow`). Needs approval for a sync change.
- **React Flow fit:** native `zIndex` on nodes; the sync gap is a Liveblocks mapping issue, so custom sync for `zIndex` = extra work.
- **Priority:** P2.
- **Risks:** Storage for ordering; a fractional index is the robust approach (F-Z01).

### F-Z01 Fractional indexing for element order
- **Observed:** Element order is stored as fractional index strings, so reordering touches only the moved element. Invalid indices are repaired on load (`syncInvalidIndices`). Moves re-index moved items (`syncMovedIndices`).
- **Evidence:** `packages/element/src/fractionalIndex.ts` L23 (`InvalidFractionalIndexError`), L49 (`validateFractionalIndices`), L150 (`orderByFractionalIndex`), L175 (`syncMovedIndices`), L223 and L242 (sync invalid); `packages/fractional-indexing/` (separate package, standard algorithm).
- **drawArc mapping:** New feature, paired with F-Z01's z-order. Probably part of the same "z-order" feature. Also relevant to F14 templates, which currently use node order.
- **React Flow fit:** custom. The React Flow node array order does not carry a concurrency-safe index.
- **Priority:** P2 (only if z-order is built).
- **Risks:** Adds a dependency (`fractional-indexing` npm package) — needs owner approval per CLAUDE.md section 2.

### F-G06 Frames: frame tool, clipping, names
- **Observed:** A frame is a container element. Children are clipped to the frame when frame rendering clip is on (`shouldApplyFrameClip`). Frames have a name shown above the frame; default name is "Frame" (`DEFAULT_FRAME_NAME`); AI frames default to a different name. Shortcuts for frames are menu-driven (`actionFrame.ts` labels: select all in frame, remove all elements from frame, toggle frame rendering).
- **Evidence:** `packages/element/src/frame.ts` L937 (`shouldApplyFrameClip`), L1004-1011 (`getDefaultFrameName`, `getFrameLikeTitle`), L110-153 (`getElementsCompletelyInFrame`, `getElementsIntersectingFrame`); `actionFrame.ts` L54, L91, L122, L275.
- **drawArc mapping:** New feature (no frames in specs). Relevant as a "section" for system diagrams (e.g., VPC or region boundary).
- **React Flow fit:** native via group-like parent nodes (`type: 'group'` pattern with `parentId`); clip via `overflow: hidden` on the parent node.
- **Priority:** P2 for system design (region or VPC grouping) — strong fit for a system-design canvas.
- **Risks:** Frame children membership is computed on move; with React Flow sub-flows, membership is explicit, so the logic is simpler than Excalidraw's.

## Findings: snapping and alignment

### F-S01 Object snapping: points, edges, centres
- **Observed:** When object snapping is on (Alt+S), dragged elements snap to other elements' edges and centres with snap lines drawn. Snap distance is 8 px on screen (`SNAP_DISTANCE / zoom`).
- **Evidence:** `packages/excalidraw/snapping.ts` L41 (`SNAP_DISTANCE = 8`), L48-49 (`getSnapDistance`), L616 (`getReferenceSnapPoints`), L692 (`snapDraggedElements`), L1108 (`snapResizingElements`), L1246 (`snapNewElement`); `shortcuts.ts` L97 (`objectsSnapMode: Alt+S`).
- **drawArc mapping:** New feature (no snapping in specs). P2 candidate for system design layouts.
- **React Flow fit:** React Flow native: `snapToGrid` / `snapGrid` only (grid). Object snapping = custom logic on `onNodeDrag` with a helper lines overlay (React Flow has no built-in guide lines; an example in React Flow docs uses `onNodeDrag` for helper lines — UNVERIFIED in this session).
- **Priority:** P2.
- **Risks:** Performance of N×N snap checks with many nodes; throttle in drag handler.

### F-S02 Gap snapping (equal spacing between shapes)
- **Observed:** Gap snapping shows equal-distance markers when a dragged element lands at the same gap as neighbours (`getVisibleGaps`, `GapSnap` types).
- **Evidence:** `snapping.ts` L65-96 (types `Gap`, `GapSnap`), L328 (`getVisibleGaps`), `VISIBLE_GAPS_LIMIT_PER_AXIS = 99999` at L45.
- **drawArc mapping:** New feature, paired with F-S01.
- **React Flow fit:** custom, same as F-S01.
- **Priority:** P3.
- **Risks:** Adds visual noise; keep disabled by default.

### F-S03 Grid mode and grid size
- **Observed:** Grid mode is toggled with Ctrl/Cmd+'. Default grid size is 20 px; the grid step (major lines) is 5. Grid mode snaps dragged elements to the grid. Grid mode also disables Ctrl-to-snap as an alternative.
- **Evidence:** `shortcuts.ts` L95 (`gridMode: Ctrl/Cmd+'`); `packages/common/src/constants.ts` L296-297 (`DEFAULT_GRID_SIZE = 20`, `DEFAULT_GRID_STEP = 5`); `appState.ts` L80-81; `snapping.ts` L159-160 (`isGridModeEnabled`).
- **drawArc mapping:** New feature (no grid in specs). P1-P2 candidate since it helps alignment with no extra cost.
- **React Flow fit:** native: `snapToGrid={true}` `snapGrid={[20, 20]}`, plus a `<Background variant="lines" gap={20}/>` for the grid overlay. Very cheap.
- **Priority:** P1 (cheap, high value).
- **Risks:** Dark-only theme: grid colour token needed (ui-context).

### F-S04 Snap toggle and modifier inversion
- **Observed:** Alt+S toggles object snapping. Holding Ctrl/Cmd during a drag inverts the snap state for that gesture. Snapping is not applied while a single arrow is selected (arrows use binding instead). Shift is not the snap modifier (correction to the brief).
- **Evidence:** `shortcuts.ts` L97; `snapping.ts` L162-191 (`isSnappingEnabled`); `snapping.ts` L177-190 for the arrow exception.
- **drawArc mapping:** Part of F-S01.
- **React Flow fit:** custom key state.
- **Priority:** P2.
- **Risks:** Modifier conflicts with browser shortcuts (Ctrl+Alt on Windows is AltGr); Excalidraw avoids Alt+letter for most actions.

### F-S05 Align actions (left, right, top, bottom, centre)
- **Observed:** Ctrl/Cmd+Shift+Arrow aligns the selection: Left, Right, Up (top), Down (bottom). Centre alignment is a panel button (`position: "center"`); no separate keyboard key was seen for centre. Align is hidden unless 2+ elements are selected (`alignActionsPredicate`).
- **Evidence:** `actionAlign.tsx` keyTests L97-98 (up), L131-132 (down), L165-166 (left), L199-200 (right); `actionAlign.tsx` L227, L257 (`position: "center"`); `packages/element/src/align.ts` (86 lines, not read in full).
- **drawArc mapping:** New feature (no align in specs). P1-P2: align is a basic layout need once node count grows.
- **React Flow fit:** custom: compute positions from `getNodesBounds` and set via `setNodes`. Cheap, no React Flow feature needed.
- **Priority:** P2.
- **Risks:** Undo: one Liveblocks batch needed so one Ctrl+Z reverts an align (F10 FR-012 rule).

### F-S06 Distribute actions (horizontal, vertical)
- **Observed:** Alt+H distributes horizontally (equal spacing). Vertical distribute is in the same action file but its key was not confirmed in this read (UNVERIFIED). Distribute requires 3+ elements.
- **Evidence:** `actionDistribute.tsx` keyTest L88-89 (`!ctrl && alt && code H`); `packages/element/src/distribute.ts` (119 lines, not read in full).
- **drawArc mapping:** New feature, paired with F-S05.
- **React Flow fit:** custom, same as F-S05.
- **Priority:** P3.
- **Risks:** Same as F-S05.

## Findings: images

### F-I01 Image insertion: file picker, paste, drag-drop
- **Observed:** Images can be inserted from the file picker, pasted from clipboard, or dropped onto the canvas. Insertion creates a placeholder element first, then replaces it when the file is ready (`placeholderImageElement`, `imageCache`, `getLatestInitializedImageElement`).
- **Evidence:** `packages/excalidraw/components/App.tsx` ~L10391-10475 (insert function with placeholder), L642 (`imageCache`), L3799 and L3942 (cache cleanup).
- **drawArc mapping:** New feature (ui-context lists no image node; F07 shapes are fixed six). Candidate P2 for diagrams with icons or screenshots.
- **React Flow fit:** custom node type (`image` node) with `data.fileId`; file bytes stored outside Liveblocks (Blob via the existing snapshot pattern), since Liveblocks storage should not hold binary.
- **Priority:** P2.
- **Risks:** Binary storage: needs a Blob path and an auth check; adds a dependency on Vercel Blob (already in the stack, per CLAUDE.md).

### F-I02 File storage model: the files map (dataURL, mimeType, created, lastRetrieved)
- **Observed:** Image bytes are kept in a separate `files` map keyed by file id. Each entry has `mimeType`, `id`, `dataURL` (base64 data URL), `created` and `lastRetrieved`. Elements reference the file by `fileId`. Files are added with `addMissingFiles`.
- **Evidence:** `packages/excalidraw/types.ts` L122-132 (`BinaryFileData`); `App.tsx` ~L10455-10465 (`addMissingFiles` call).
- **drawArc mapping:** New feature, paired with F-I01. Keep the separate-map idea: it stops image data from being copied into every snapshot.
- **React Flow fit:** custom; separate file storage keyed by node `data.fileId`.
- **Priority:** P2 (with F-I01).
- **Risks:** Data URLs inflate snapshots 33%; prefer Blob URLs in drawArc.

### F-I03 Size and resolution limits
- **Observed:** Before storing, an image is resized so its longest side is at most 1440 px (`maxWidthOrHeight`). If the file is still larger than 4 MB (`maxFileSizeBytes`), insertion fails with a "file too big" error. Both limits are host-overridable.
- **Evidence:** `packages/common/src/constants.ts` L407-410 (`DEFAULT_IMAGE_OPTIONS`); `App.tsx` ~L10428-10449 (`resizeImageFile`, size check); `packages/excalidraw/index.tsx` L151-155 (props).
- **drawArc mapping:** New feature, paired with F-I01. Reuse these defaults in the server validation.
- **React Flow fit:** app/server logic, not React Flow.
- **Priority:** P2.
- **Risks:** Client resize is not a security boundary; server must enforce the limit.

### F-I04 Supported types and SVG handling
- **Observed:** Accepted image MIME types: SVG, PNG, JPEG, GIF, WebP, BMP, ICO, AVIF, JFIF. SVG is normalised before use (`normalizeSVG`) and rendered as an image element; SVG content is sanitised before use (sanitisation path not read).
- **Evidence:** `packages/common/src/constants.ts` L299-310 (`IMAGE_MIME_TYPES`); `App.tsx` L4952-4956 (SVG branch with `normalizeSVG`); `packages/excalidraw/data/blob.ts` L64-67 and L100 (`.svg` detection).
- **drawArc mapping:** New feature, paired with F-I01. If SVG is allowed, sanitise on the server (security).
- **React Flow fit:** app/server.
- **Priority:** P3 (accept PNG/JPEG/WebP/SVG only at first).
- **Risks:** SVG can carry script; require sanitisation before any inline render (UNVERIFIED depth of Excalidraw's sanitiser).

### F-I05 Crop mode
- **Observed:** Images have a crop editor toggled from the context menu or panel (`actionToggleCropEditor`); cropping is a state (`croppingElementId`) while the crop is edited, and the crop is stored on the element.
- **Evidence:** `packages/excalidraw/actions/actionCropEditor.tsx` L13-19; `App.tsx` L6168 and L6173 (`croppingElementId`).
- **drawArc mapping:** New feature, paired with F-I01. Low priority.
- **React Flow fit:** custom node UI.
- **Priority:** P4 (skip until images exist).
- **Risks:** Crop UI is a second editing mode; keep out of scope.

### F-I06 Placeholder and loading states
- **Observed:** A placeholder image element is shown while the file is read and resized, then swapped for the real image; a missing file shows an error path (`imageInsertError`).
- **Evidence:** `App.tsx` ~L10391-10475 (`placeholderImageElement`, `getLatestInitializedImageElement`); `packages/element/src/types.ts` L122-126 (`status: "pending" | "error"`, `"done"`).
- **drawArc mapping:** New feature, paired with F-I01.
- **React Flow fit:** custom node with `data.status`.
- **Priority:** P3.
- **Risks:** Uploads can fail mid-collaboration; the placeholder state must be shared or private (decide).

## Findings: libraries

### F-L01 Library sidebar and insertion
- **Observed:** A library sidebar holds reusable item groups. Clicking an item inserts it into the canvas at the cursor or centre; dragging an item onto the canvas also inserts it (drag-to-insert; the exact drag handler was not read — click insertion is verified by `addElementsFromPasteOrLibrary` and its `position` option).
- **Evidence:** `packages/excalidraw/components/LibraryMenu*.tsx` (file list); `App.tsx` L4617-4649 (`addElementsFromPasteOrLibrary` with `position: "cursor" | "center" | {clientX, clientY}`); `data/library.ts` L405-420 (`distributeLibraryItemsOnSquareGrid`).
- **drawArc mapping:** New feature (ui-context has no library). Only if drawArc wants reusable component stencils; F14 templates are whole-canvas replacements, so this is a separate idea.
- **React Flow fit:** app UI for the sidebar; insertion = `addNodes` with fresh ids (`newNodeId(shape)`).
- **Priority:** P3.
- **Risks:** Library items must be validated with the canvas Zod schema (domain-model rule for templates applies too).

### F-L02 Library item format
- **Observed:** A library item is `{ id, status: "published" | "unpublished", elements, created, name?, error? }`. A library file is saved as `.excalidrawlib` with type `excalidrawlib`. Older library formats (v1) are migrated on load (`LibraryItems_v1`).
- **Evidence:** `packages/excalidraw/types.ts` L656-666 (`LibraryItem`); `packages/common/src/constants.ts` L348-351 (`EXPORT_DATA_TYPES`, `excalidrawLibrary: "excalidrawlib"`); `data/library.ts` L70 (`LibraryPersistedData`), L92-102 (adapter get/set).
- **drawArc mapping:** New feature, paired with F-L01.
- **React Flow fit:** app/data layer.
- **Priority:** P3.
- **Risks:** Versioning: any library file format needs a version field from day one.

### F-L03 Add selection to library
- **Observed:** Selected elements can be added to the library as a new item (`actionAddToLibrary`). The item stores the element copies and a timestamp.
- **Evidence:** `packages/excalidraw/actions/actionAddToLibrary.ts` (file list; body not read).
- **drawArc mapping:** New feature, paired with F-L01.
- **React Flow fit:** app logic.
- **Priority:** P3.
- **Risks:** Copies carry node ids; re-id on insert (F-C06).

### F-L04 Publishing to the public libraries site (hosted and editor)
- **Observed:** Items can be marked published and submitted to a backend (`VITE_APP_LIBRARY_BACKEND/submit`). The public site `libraries.excalidraw.com` lists libraries with downloads, dates, and two links (add to Excalidraw, download). Publishing on the site is done via GitHub instructions per the site's text (WebFetch summary). The publish submit path is in the editor package but needs the backend, which is hosted.
- **Evidence:** `packages/excalidraw/components/PublishLibrary.tsx` L318 (submit URL), L406 (link to libraries site), L390 (filter published items); `excalidraw-app/App.tsx` ~L1173 (publish path, hosted); https://libraries.excalidraw.com (WebFetch summary, 2026 snapshot).
- **drawArc mapping:** Skip for now. A public library site is a separate product.
- **React Flow fit:** not applicable; server and hosting.
- **Priority:** P4.
- **Risks:** A public library needs moderation, licensing (site MIT) and abuse controls; out of scope for a private canvas.

### F-L05 Library import from URL (hosted)
- **Observed:** Opening the app with a library token in the URL imports that library into the user's library after confirmation. The allowlist covers `excalidraw.com` and a GitHub raw path for library PRs.
- **Evidence:** `packages/excalidraw/data/library.ts` L54-58 (`ALLOWED_LIBRARY_URLS`); `excalidraw-app/App.tsx` L572-573 (`parseLibraryTokensFromUrl`) — hosted.
- **drawArc mapping:** Skip. Hosted-only and tied to the public site.
- **React Flow fit:** not applicable.
- **Priority:** P4.
- **Risks:** URL-driven import is an injection vector; if ever built, allowlist the host.

## Findings: clipboard, paste, duplicate

### F-C01 Copy and paste with an excalidraw JSON clipboard type
- **Observed:** Copy writes both the system clipboard text (JSON with type `excalidraw/clipboard`) and internal state. Paste parses the JSON if present; otherwise it pastes plain text. Images and text on the clipboard are handled separately.
- **Evidence:** `packages/excalidraw/clipboard.ts` L520-553 (`parseClipboard`, `clipboardContainsElements`); `packages/common/src/constants.ts` L348-351 (`excalidrawClipboard`).
- **drawArc mapping:** Upgrade F10 (copy/paste is not yet listed in F10 FR-006 map as copy/paste; F10 covers duplicate and delete). Add copy/paste between tabs or projects as a new capability.
- **React Flow fit:** app logic; clipboard JSON is validated with the canvas Zod schema on paste.
- **Priority:** P1 (copy/paste of nodes is daily use).
- **Risks:** Pasting untrusted JSON from the system clipboard must be validated (domain-model rule: Zod at every boundary).

### F-C02 Plain paste (Ctrl+Shift+V)
- **Observed:** Plain paste ignores the element JSON and inserts the text as a text element or as the JSON text (`isPlainPaste` writes the elements as JSON text).
- **Evidence:** `clipboard.ts` L333-339 (`isPlainPaste` path), L546-548 (`text: isPlainPaste ? JSON.stringify(...)`).
- **drawArc mapping:** Skip for now; low value.
- **React Flow fit:** app logic.
- **Priority:** P4.
- **Risks:** Low.

### F-C03 Paste position: cursor, centre, or event point
- **Observed:** Pasted or library content is placed at a scene coordinate: the last pointer position ("cursor"), the viewport centre ("center"), or an explicit client point. The elements are duplicated with new ids at that coordinate (`duplicateAtSceneCoords`).
- **Evidence:** `App.tsx` L4617-4650 (`addElementsFromPasteOrLibrary`, clientX/clientY from `viewport.lastPosition` or `state.width/2`), `viewportCoordsToSceneCoords`.
- **drawArc mapping:** Upgrade F10 (paste lands at the cursor). Currently F10 duplicates offset by +20/+20 (FR-007).
- **React Flow fit:** native `screenToFlowPosition` (React Flow 12) for cursor placement.
- **Priority:** P1 (with F-C01).
- **Risks:** Multi-node paste keeps relative positions; compute the group bounding box centre.

### F-C04 Duplicate (Ctrl+D) and Alt+drag
- **Observed:** Ctrl/Cmd+D duplicates the selection; Alt+drag duplicates while moving. Duplicates get new ids and the same styles. Exact offset value on Ctrl+D was UNVERIFIED in this read.
- **Evidence:** `shortcuts.ts` L76-78 (`duplicateSelection`: Ctrl/Cmd+D and Alt+drag); `actionDuplicateSelection.tsx` L34-47; `packages/element/src/duplicate.ts` L136 (`duplicateElements`, `randomizeSeed`, `overrides`).
- **drawArc mapping:** Upgrade F10 FR-007 (already duplicate with +20/+20). Add Alt+drag duplicate as a new interaction.
- **React Flow fit:** custom: a drag handler that clones nodes on Alt keydown.
- **Priority:** P2.
- **Risks:** Alt+drag collides with OS shortcuts on some Linux desktops.

### F-C05 Copy as PNG and copy as SVG
- **Observed:** Shift+Alt+C copies the selection as a PNG image to the system clipboard (`copyAsPng`). Copy as SVG is available via export actions (not read in detail).
- **Evidence:** `shortcuts.ts` L92 (`copyAsPng`); `clipboard.ts` L~580-610 (`copyBlobToClipboardAsPng` with Safari-safe `ClipboardItem`).
- **drawArc mapping:** New feature (export is not in specs; F19 import/export is Future). Candidate P3 with F19.
- **React Flow fit:** app/server (render to canvas or SVG via `toSvg`/`html-to-image`-style exporter — not a React Flow built-in; UNVERIFIED which lib Excalidraw uses here).
- **Priority:** P3.
- **Risks:** Safari needs the synchronous ClipboardItem path (note from source).

### F-C06 Cut, copy, paste ids and re-id
- **Observed:** Pasted elements get fresh ids, so pasting into the same canvas never collides; a cut is copy plus delete (`actionClipboard.tsx`, names only).
- **Evidence:** `packages/excalidraw/actions/actionClipboard.tsx` (cut/copy/paste actions, 291 lines, not read in full); `clipboard.ts` `deepCopyElement`; `duplicate.ts` L136.
- **drawArc mapping:** Upgrade F10 (cut and paste not in specs). drawArc's `newNodeId(shape)` already re-ids.
- **React Flow fit:** native `addNodes` + custom re-id.
- **Priority:** P1 (cut is part of copy/paste).
- **Risks:** Edges referencing re-id'd nodes must be remapped on paste (same as F09 FR-009 rule). Easy to miss.

## Could not verify

- Exact duplicate offset on Ctrl+D (F-C04) and whether Alt+drag clones or only offsets.
- Vertical distribute shortcut (F-S06).
- Exact double-click behaviour into a group (F-G02); the handler branch was not read.
- Whether library items can be dragged onto the canvas (F-L01); drag handler not read. Click insertion verified.
- SVG sanitiser depth (F-I04).
- Which export/render library Excalidraw uses for copy-as-SVG (F-C05).
- Rendering and look of snap guides, grid colours, frame labels, and suggested-binding highlight — no image or live app was opened, so no visual claim is made.
- `dev-docs` has no page found for arrows, snapping or libraries in this listing; a fuller docs search was not performed.
- Hosted-only behaviours (library publishing backend, collaboration features in `excalidraw-app/`) are only identified by file, not analysed.

## Top 10 recommendations for drawArc

1. **P1 — Grid snap (F-S03):** `snapToGrid` + `snapGrid={[20,20]}` + `<Background>` lines. Almost free; pair with Alt-free toggle (Ctrl+').
2. **P1 — Copy, cut, paste with JSON (F-C01, F-C06):** validated with the canvas Zod schema, re-id on paste, remap edges. Extends F10.
3. **P1 — Paste at cursor (F-C03):** `screenToFlowPosition`; extends F10 FR-007.
4. **P2 — Group and ungroup (F-G01, F-G03) with sub-flows:** start with one level; decide on nested groups before schema work.
5. **P2 — Frames as system-design sections (F-G06):** parent nodes with `overflow: hidden`; strong fit for VPC or region boundaries.
6. **P2 — Lock per node (F-G04):** `data.locked`, `draggable={false}`, `selectable={false}`; Ctrl+Shift+L toggle.
7. **P2 — Object snapping and alignment (F-S01, F-S05):** align is simple `setNodes`; snapping needs drag-handler helper lines. Ship align before snapping.
8. **P2 — Edge marker kinds and round/elbow edge style (F-A01, F-A03):** arrowhead start and end; keep to 3–4 kinds; round is a `type` option. Needs an edge-style field in the canvas schema (approval).
9. **P2 — Z-order via fractional index (F-G05, F-Z01):** only after `zIndex` sync is solved; ask for approval to add the `fractional-indexing` dependency.
10. **P2 — Images as an image node with a Blob-backed file map (F-I01–F-I03):** keep 1440 px and 4 MB limits; validate on the server; accept PNG, JPEG, WebP, and SVG only after sanitising.

Skip for now: free arrow binding (F-A06), binding toggle (F-A09), public library site and URL import (F-L04, F-L05), crop mode (F-I05), copy as PNG (defer to F19), plain paste (F-C02).
