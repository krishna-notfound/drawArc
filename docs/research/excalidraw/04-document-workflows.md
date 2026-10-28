# Excalidraw research 04: document workflows

Area: new document / reset, `.excalidraw` JSON format, restore and migration, export (PNG/SVG/clipboard), import (open, drop, paste), image `files` map, hosted persistence and recovery, libraries (format only), element schema evolution, Mermaid / text-to-diagram import.

Upstream commit: excalidraw/excalidraw `14bb42e` (2026-10-27), shallow clone. Clone root (not repeated below): `C:\Users\krishna\AppData\Local\Temp\claude\C--Users-krishna-Desktop-ghost-ai\08ecd18a-36e3-4565-878b-6db09b1b6b54\scratchpad\excalidraw-src`. Paths below are relative to that root.

Scope labels: **[editor]** = `packages/*` (open-source editor package). **[hosted]** = `excalidraw-app/*` (excalidraw.com app: localStorage, IndexedDB, Firebase, share links). Anything not opened is marked **UNVERIFIED**.

drawArc baseline (from the repo, skimmed): `context/domain-model.md` (canvas schema v1, Blob snapshot `canvas/{projectId}.json`, caps 4 MB / 2,000 nodes / 4,000 edges), `context/data-ownership.md` (Liveblocks Storage is live truth; Blob is authoritative only when the room is empty), `features/13-persistence-and-recovery` (debounced Blob autosave 30 s / max-wait 60 s, forward migration, empty-room guard, pointer fields on `Project`), `features/14-starter-templates` (code-defined templates, replace-canvas confirmation, one Liveblocks message per import), `features/19-import-export` (future milestone; JSON download/import, PNG/SVG export; import is editor+ and validates with `CanvasDocumentSchema`; import/export of other formats is out of scope). Implementation status of F13, F14 and F19 was not checked (their `status.md` files were not opened); the statements here describe the specifications only. `features/README.md` was only partly read (dependency graph).

## Sources inspected

Editor package [editor]:
- `packages/excalidraw/data/json.ts` (serializeAsJSON, saveAsJSON, loadFromJSON, isValidExcalidrawData, library serialisers)
- `packages/excalidraw/data/types.ts` (ExportedDataState, ImportedDataState, LegacyAppState)
- `packages/excalidraw/data/restore.ts` (restoreElement, restoreElements, restoreAppState, bumpElementVersions, LegacyAppStateMigrations; lines 126-560, 960-1030, 1189-1372)
- `packages/excalidraw/data/blob.ts` (loadSceneOrLibraryFromBlob, loadFromBlob, parseLibraryJSON, canvasToBlob, generateIdFromFile, resizeImageFile; lines 140-260, 263-360)
- `packages/excalidraw/data/image.ts` (PNG tEXt encode/decode)
- `packages/excalidraw/data/encode.ts` (encode/decode, compression, encryption entry points)
- `packages/excalidraw/data/resave.ts`, `packages/excalidraw/data/reconcile.ts` (lines 1-45)
- `packages/excalidraw/data/library.ts` (library version and dedupe, grep only)
- `packages/excalidraw/scene/export.ts` (exportToCanvas config, SVG font style block, embedScene payload, exportToBlob, exportToClipboard; lines 525-545, 960-1060, 1100-1140, 1293-1404)
- `packages/excalidraw/appState.ts` (APP_STATE_STORAGE_CONF lines 159-298, _clearAppStateForStorage, clearAppStateForDatabase)
- `packages/excalidraw/types.ts` (BinaryFileData, lines 122-140)
- `packages/excalidraw/fonts/Fonts.ts` (generateFontFaceDeclarations, lines 229-260), `packages/excalidraw/fonts/ExcalidrawFontFace.ts` (fetch and fallback URL, lines 11, 54-105)
- `packages/excalidraw/components/ImageExportDialog.tsx` (lines 60-160, 220-340)
- `packages/excalidraw/components/ActiveConfirmDialog.tsx`, `packages/excalidraw/components/App.tsx` (lines 5601, 10430-10446, 10768-10960)
- `packages/excalidraw/components/App.clipboard.ts` (lines 196-230, Mermaid paste path)
- `packages/excalidraw/mermaid.ts` (isMaybeMermaidDefinition)
- `packages/excalidraw/components/TTDDialog/MermaidToExcalidraw.tsx`, `TTDDialog.tsx` (lines 50-150, names and loader only)
- `packages/excalidraw/actions/actionExport.tsx` (saveToActiveFile, saveFileToDisk, loadScene, lines 254-420)
- `packages/excalidraw/actions/actionCanvas.tsx` (clearCanvas, lines 85-125)
- `packages/element/src/types.ts` (element base fields, lines 56-80; ExcalidrawImageElement, lines 160-170)
- `packages/element/src/mutateElement.ts` (bumpVersion, lines 188-196)
- `packages/element/src/fractionalIndex.ts` (header comment only)
- `packages/common/src/constants.ts` (VERSIONS line 419, DEFAULT_IMAGE_OPTIONS and EXPORT_SCALES lines 402-410, SAVE constants not here)

Hosted app [hosted]:
- `excalidraw-app/data/LocalData.ts` (save debounce, saveDataStateToLocalStorage, file cleanup, save lock; lines 40-175 read partly)
- `excalidraw-app/data/tabSync.ts`, `excalidraw-app/data/Locker.ts`, `excalidraw-app/app_constants.ts` (lines 2-12, 39-41)
- `excalidraw-app/data/FileManager.ts` (lines 240-255 only), `excalidraw-app/collab/Collab.tsx` (line 183, file max bytes)

Docs and other:
- `dev-docs/docs/codebase/json-schema.mdx` (full, 87 lines)
- `dev-docs/docs/@excalidraw/excalidraw/api/utils/restore.mdx` (partial)
- `packages/excalidraw/package.json` (line 91: `@excalidraw/mermaid-to-excalidraw` 3.0.0)
- Not opened: `packages/utils/` export helpers, `packages/excalidraw/data/filesystem.ts`, `packages/excalidraw/data/image.ts` beyond PNG chunks, `packages/excalidraw/data/index.ts` (only one grep hit), `excalidraw-app/data/firebase.ts`, `excalidraw-app/data/fileStatusStore.ts`, `packages/excalidraw/data/ai/`, `dev-docs/docs/assets/*.png` (not relevant to this area; no image was opened).
- https://docs.excalidraw.com was not fetched (repo was enough for this area).

---

## Findings

Format per CLAUDE.md section 9. Each finding: name · observed behaviour · evidence · drawArc mapping · React Flow fit · priority · risks.

### A. New document, reset, confirmation

**A1. Clear canvas as soft delete with confirmation** [editor]
- Observed: "Clear canvas" marks every element `isDeleted: true` (not removed), empties `files`, and keeps only a set of preferences (theme, penMode, export background/embed, grid settings, stats, top picks). It is one `CaptureUpdateAction.IMMEDIATELY` update. The action is gated by `canvasActions.clearCanvas` (host option) and hidden in view mode. Confirmation is a global dialog atom opened from App, not inside the action.
- Evidence: `packages/excalidraw/actions/actionCanvas.tsx:85-125`; `packages/excalidraw/components/App.tsx:5601` (`updateEditorAtom(activeConfirmDialogAtom, "clearCanvas")`); `packages/excalidraw/components/ActiveConfirmDialog.tsx:8,20-28`.
- drawArc mapping: upgrade **F14** (replace-canvas confirmation) with a "blank canvas" option, and specify it as one Liveblocks batch and one undo step, as F14 already requires.
- React Flow fit: extra interaction logic (batch delete of nodes and edges plus snapshot reset); collaboration.
- Priority: P2.
- Risks: do not copy soft delete. Excalidraw keeps deleted elements for reconciliation; in drawArc, tombstones would grow the Liveblocks room (10 MB limit per data-ownership.md). Use real deletes plus an undo entry. Confirmation copy must name the room's other editors.

**A2. No unsaved-changes prompt on unload in the hosted app** [hosted] — UNVERIFIED for the UI
- Observed: `excalidraw-app/` has no `beforeunload` or `pagehide` listener (grep). The only `beforeunload` in `packages/` is in the text editor (`packages/excalidraw/wysiwyg/textWysiwyg.tsx:1108`, commits a text edit). Local save is debounced 300 ms, so the unsaved window is short. Whether the hosted app shows a native prompt in other code paths is UNVERIFIED.
- Evidence: grep of `excalidraw-app` and `packages/` for `beforeunload|pagehide|visibilitychange`; `excalidraw-app/app_constants.ts:2`.
- drawArc mapping: F13 already specifies flush on `hide`/`pagehide`. Keep it; no new feature. The Excalidraw evidence suggests a short debounce plus flush is enough.
- React Flow fit: app UI.
- Priority: P3.
- Risks: a 30 s debounce (F13) leaves a wider loss window than Excalidraw's 300 ms; F13's flush on `pagehide` must be tested.

### B. `.excalidraw` JSON envelope and persistence scope

**B1. File envelope: type, version, source, elements, appState subset, files** [editor]
- Observed: `serializeAsJSON` writes `{ type: "excalidraw", version: 2, source, elements, appState, files }`, pretty-printed with 2 spaces. `type` is the discriminator; `isValidExcalidrawData` checks `type === "excalidraw"` and that `elements` is an array if present. MIME type is `application/vnd.excalidraw+json`. Libraries use a separate envelope (`type: "excalidrawlib"`, `version: 2`).
- Evidence: `packages/excalidraw/data/json.ts:46-65,121-127`; `packages/excalidraw/data/types.ts:17-24`; `packages/common/src/constants.ts:419-422`; `dev-docs/docs/codebase/json-schema.mdx` (attribute table and example).
- drawArc mapping: **F19** (export/import format). Use a drawArc-specific discriminator (for example `type: "drawarc-canvas"`) and a `schemaVersion` that matches F06/F13 naming. Do not reuse Excalidraw's type string.
- React Flow fit: native (nodes/edges serialise directly), but the file must carry the F06 `CanvasDocument` shape, not React Flow internal state.
- Priority: P1 (F19 format is the core of the feature).
- Risks: adding `source` leaks the app URL. Decide whether to include it; drawArc may not need it.

**B2. Persisted appState is an allow-list per target** [editor]
- Observed: every appState key has `browser`, `export` and `server` flags. Only five keys are `export: true` (`gridSize`, `gridStep`, `gridModeEnabled`, `viewBackgroundColor`, `lockedMultiSelections`). Viewport (`scrollX`, `scrollY`, `zoom`), selection, tool state and UI state are excluded from file export but kept in browser storage (`browser: true`). The server target (`clearAppStateForDatabase`) keeps only the same five keys. Transient keys (`newElement`, `editingTextElement`, `isLoading`, `toast`, and others) are `false` everywhere.
- Evidence: `packages/excalidraw/appState.ts:159-298` (config), `:299-333` (`_clearAppStateForStorage`, `cleanAppStateForExport`, `clearAppStateForDatabase`).
- drawArc mapping: **F19** and **F13**. The exported file should contain the drawing plus a small, explicit settings block (for example grid, background), not viewport or selection. The F13 snapshot should follow the same rule.
- React Flow fit: native (viewport lives in React Flow store; exclude it from the document).
- Priority: P2.
- Risks: including viewport in exports makes re-import jump the view; the spec should say "fit view on import" (F14 already does `fitView` once).

**B3. Two serialisation targets: local file vs database** [editor]
- Observed: `serializeAsJSON(..., "local" | "database")`. `"local"` includes `files` minus files referenced only by deleted elements (`filterOutDeletedFiles`). `"database"` sets `files: undefined` (binary data is stripped before persisting).
- Evidence: `packages/excalidraw/data/json.ts:28-44`.
- drawArc mapping: **F13** (snapshot excludes image data by design today, there are no images) and **F19** (file includes everything needed to re-import). Keep one function with a target parameter, as Excalidraw does.
- React Flow fit: native.
- Priority: P3 (no image nodes yet).
- Risks: a file and a snapshot diverging in content. Derive both from one `toDocument()` (F06 already names `toDocument`/`fromDocument`).

**B4. Document-level version is advisory, not a dispatch key** [editor]
- Observed: `VERSIONS.excalidraw = 2`. `restoreElements` and `restoreAppState` do not switch on the file `version`. They normalise by field presence (`element.version || 1`, `x ?? element.x ?? 0`, legacy keys checked with `!== undefined`). Migration is shape-based.
- Evidence: `packages/common/src/constants.ts:419-422`; `packages/excalidraw/data/restore.ts:450-540` (base defaults), `:1189-1219` (`LegacyAppStateMigrations`), `:1268-1372` (`restoreAppState`).
- drawArc mapping: **F13** `migrate` should key on `schemaVersion` explicitly, with one function per step and fixtures per version (F13 already requires fixtures). Excalidraw's shape-based approach is a fallback, not a model to copy.
- React Flow fit: native.
- Priority: P1 (F13 acceptance requires forward migration).
- Risks: a version-keyed chain needs a strict "unknown future version" rule (reject with a message, never silently downgrade). Excalidraw does not define this; drawArc must.

### C. Restore, normalisation and backward compatibility

**C1. Per-element normalisation with forward-compatible spread** [editor]
- Observed: `restoreElementWithProperties` builds a `base` of defaults (`version || 1`, `versionNonce ?? 0`, `index ?? null`, `isDeleted ?? false`, `seed ?? 1`, `groupIds ?? []`, `frameId ?? null`, dimensions normalised), then returns `{ ...element, ...base, ...extra }`. Unknown properties survive. Legacy properties are removed after migration (`strokeSharpness`, `boundElementIds`, `moveMidPointsWithElement`); `rawText` is deleted on text elements.
- Evidence: `packages/excalidraw/data/restore.ts:450-540` (comment: "spread the original element properties ... for forward-compatibility"), `:553-557` (legacy `rawText` cleanup).
- drawArc mapping: **F06** `CanvasDocumentSchema` and **F13** migration. Use zod defaults for known fields and passthrough for unknown fields so an older client does not drop newer data, but make the server validator (F13, 422) strict on write. These two rules conflict; the spec must choose one per direction.
- React Flow fit: native (node `data` and `style` are free-form objects in React Flow).
- Priority: P1.
- Risks: passthrough on write lets arbitrary keys into Liveblocks and Blob. Use passthrough on read only.

**C2. Duplicate ids regenerated during restore** [editor]
- Observed: during `restoreElements`, a second element with an id already seen gets `id: randomId()`. Restore also drops elements whose `type === "selection"` (legacy). Per-element `try/catch` drops an element that throws and logs `console.error`; it does not reject the file.
- Evidence: `packages/excalidraw/data/restore.ts:960-1019` (`existingIds`, `restoreElements` reduce, `console.error("Error restoring element:")`).
- drawArc mapping: **F19** import and **F14** template instantiation. F19 G-1 requires identical ids on round trip into an empty project; F14 requires fresh ids per template instantiation. Adopt: keep ids on import when no collision in the target room, regenerate only on collision.
- React Flow fit: native (node and edge ids must be unique in React Flow; collisions break edges).
- Priority: P1.
- Risks: regenerating ids silently breaks edge `source`/`target` references unless edges are remapped too. Excalidraw remaps bindings via `repairBindings`; drawArc needs an explicit id-remap table for edges.

**C3. Silent per-element drop versus whole-file rejection** [editor] — decision needed
- Observed: Excalidraw restore drops bad elements and keeps the rest (C2). Only the envelope check rejects the file (`isValidExcalidrawData`, then "Error: invalid file").
- Evidence: `packages/excalidraw/data/restore.ts:986-998`; `packages/excalidraw/data/blob.ts:200-218`.
- drawArc mapping: **F19** G-2 requires that invalid files are rejected "never partially applied" with field-level messages. That is stricter than Excalidraw. Keep F19's rule; use a lenient restore only for schema migrations of the owner's own stored snapshots, never for user-uploaded files.
- React Flow fit: app UI (error list dialog).
- Priority: P1.
- Risks: a lenient path for uploads would hide corruption. Keep the two code paths separate.

**C4. Legacy app-state migrations and coercions** [editor]
- Observed: `isSidebarDocked` is migrated to `defaultSidebarDockedPreference` (legacy key list, `LegacyAppStateMigrations`). A numeric `zoom` is coerced to `{ value }`. A string `openSidebar` becomes an object. `gridSize` and `colorTopPicks` are normalised.
- Evidence: `packages/excalidraw/data/restore.ts:1201-1219`, `:1359-1365`, `:1268-1372`; `packages/excalidraw/data/types.ts:28-38` (`LegacyAppState`, marked "#6213 TODO remove 23-06-01").
- drawArc mapping: **F13** migration fixtures. The pattern (one migration per renamed key, applied before defaults, with a removal date) is the useful part.
- React Flow fit: native.
- Priority: P3.
- Risks: a dated "TODO remove" in upstream shows legacy shims accumulate. drawArc should record a removal milestone in the migration file header.

**C5. Element index ordering normalised on restore** [editor]
- Observed: `restoreElements` calls `syncInvalidIndices` on the restored list, and `repairBindings` fixes arrow and container bindings (`restore.ts:1022+`, `:318-450`, `:775-860`).
- Evidence: `packages/excalidraw/data/restore.ts:318` (`repairBinding`), `:775` (`repairContainerElement`), `:823` (`repairBoundElement`), `:863` (`repairBoundTextElementOrder`), `:890` (`repairFrameMembership`).
- drawArc mapping: **F09** (edge repair on import) and **F19** (import must repair dangling edge endpoints). Excalidraw's repair-on-restore is a good pattern to adopt for edges whose endpoints are missing.
- React Flow fit: custom (edge validity check against node ids; React Flow does not repair this for you on `setEdges`, UNVERIFIED for the installed version).
- Priority: P2.
- Risks: silent repair hides broken references. Log the count and show it in the import summary.

### D. Element schema evolution and reconciliation

**D1. `version` / `versionNonce` for collaboration** [editor]
- Observed: every element has `version` (monotonic integer), `versionNonce` (random integer regenerated per change) and `updated` (epoch ms). `bumpVersion` increments `version`, regenerates `versionNonce`, sets `updated`. `shouldDiscardRemoteElement` keeps local when local is being edited, local version is higher, or versions tie and local nonce is lower (deterministic tie-break).
- Evidence: `packages/element/src/types.ts:56-80`; `packages/element/src/mutateElement.ts:188-196`; `packages/excalidraw/data/reconcile.ts:23-43`.
- drawArc mapping: **skip** for node CRDT state. Liveblocks Storage (LiveMap / LiveObject) already resolves concurrent writes; drawArc does not need element-level versions. Keep only the idea of a deterministic tie-break in F17 agent-write conflicts, if needed later.
- React Flow fit: collaboration (Liveblocks), not React Flow.
- Priority: P4 for drawArc.
- Risks: adding a parallel versioning scheme on top of Liveblocks would duplicate conflict resolution and must not be built.

**D2. Fractional index `index` for z-order and multiplayer ordering** [editor]
- Observed: every element has `index: FractionalIndex | null` (fractional-indexing string, rocicorp library). The array order is kept in sync with indices (`syncMovedIndices`, `syncInvalidIndices`). `null` means not yet placed in the scene.
- Evidence: `packages/element/src/types.ts:69`; `packages/element/src/fractionalIndex.ts:6,28-34` (header comment); `packages/excalidraw/data/restore.ts:1017-1019,1040+` (sync on restore).
- drawArc mapping: **new capability, not now**. drawArc node order is only needed for z-order (React Flow `zIndex`, numeric). If multi-user reordering becomes a requirement, fractional indices are the tool. Requires an approved decision.
- React Flow fit: custom (React Flow zIndex is a number; a string index needs mapping plus interaction logic).
- Priority: P3.
- Risks: a new dependency (`fractional-indexing`) needs owner approval (CLAUDE.md section 2).

**D3. New element types and fields added without breaking old files** [editor]
- Observed: new fields get defaults in `restoreElementWithProperties` (e.g. `frameId ?? null`, `groupIds ?? []`, `seed ?? 1`). New element types appear in the element union, with the default branch of `restoreElement` handling the type. Image elements carry `fileId`, `status: "pending" | "saved" | "error"`, `scale`, `crop` (`packages/element/src/types.ts:160-170`).
- Evidence: `packages/excalidraw/data/restore.ts:450-540`, `:541-775` (per-type switch); `packages/element/src/types.ts:160-170`.
- drawArc mapping: **F06** schema-v1 freeze rule. The pattern "add optional field with default, never repurpose a field" is what allows v1 files to keep working. Record this rule in `context/decision-log.md` when F06 is approved.
- React Flow fit: native.
- Priority: P1 (policy, cheap to adopt now).
- Risks: none for drawArc if the rule is written down before the first schema change.

**D4. `customData` free-form extension field** [editor]
- Observed: restore preserves an optional `customData` object on every element.
- Evidence: `packages/excalidraw/data/restore.ts:450-460` (`customData?: ExcalidrawElement["customData"]`) and the base spread.
- drawArc mapping: a possible escape hatch for per-node metadata (e.g. F17 agent provenance) without a schema bump. **Only** with owner approval, because unvalidated free-form data conflicts with F06 strict validation.
- React Flow fit: native (node `data`).
- Priority: P4.
- Risks: unbounded free-form payload; must be size-capped if used.

### E. Export

**E1. PNG export: scale, padding, background, dark mode, options** [editor]
- Observed: scale options are 1, 2, 3 (`EXPORT_SCALES`). Default padding is 10 px (`DEFAULT_EXPORT_PADDING`). Dialog toggles: "only selected" (only when a selection exists), "with background" (`exportBackground`), "dark mode" (`exportWithDarkMode`), "embed scene" (`exportEmbedScene`), scale. Export output has `maxWidthOrHeight` capping; `widthOrHeight` override exists in config.
- Evidence: `packages/common/src/constants.ts:405-407`; `packages/excalidraw/components/ImageExportDialog.tsx:74,81-104,140-145,227-303`; `packages/excalidraw/scene/export.ts:525-545` (`getExportConfigFromAppState`), `:643` (padding default), `:683-760` (scale logic).
- drawArc mapping: **F19** PNG (G-3 says 2x, 40 px padding, dark tokens). Adopt scale choices 1/2/3 and a padding parameter; set the default to what F19 says. Excalidraw's 10 px default is a value to compare, not a rule.
- React Flow fit: custom (React Flow has no built-in PNG export; the drawArc export must compute bounds from nodes (F19 names `getNodesBounds`), render off-screen, then rasterise. The rasterisation approach is UNVERIFIED for React Flow nodes with embedded fonts and HTML).
- Priority: P1 (F19 core).
- Risks: very large canvases hit browser canvas limits (E4). Rendering React Flow nodes to canvas is not the same as the editor's canvas; verify text and colour fidelity.

**E2. Dark mode is a colour transform, not a token theme** [editor]
- Observed: `exportWithDarkMode` sets `theme = DARK` for the export and applies `applyDarkModeFilter` to the painted background (and to elements, in the SVG path). The filter function body was not opened.
- Evidence: `packages/excalidraw/scene/export.ts:535`, `:1009`, `:1136`, `:1169`; `getExportConfigFromAppState` (`:525-545`).
- drawArc mapping: **F19** G-3 requires "the same tokens the canvas uses". Excalidraw uses a filter; drawArc should render the dark variant with the same token map (no colour inversion). UNVERIFIED how `applyDarkModeFilter` maps colours.
- React Flow fit: app UI (theme tokens in node styles).
- Priority: P2.
- Risks: inverted colours look wrong on coloured nodes; test with brand colours.

**E3. SVG export: fonts inlined as data via fetch; option to skip** [editor]
- Observed: `exportToSvg` writes a `<style class="style-fonts">` block with `@font-face` rules generated by `Fonts.generateFontFaceDeclarations`. It fetches woff2 files (3 concurrent requests), with fallback to an `esm.sh` URL, and subsets to characters used in the scene. `config.skipInliningFonts` disables this.
- Evidence: `packages/excalidraw/scene/export.ts:1100-1120`; `packages/excalidraw/fonts/Fonts.ts:229-260`; `packages/excalidraw/fonts/ExcalidrawFontFace.ts:11,54-105`.
- drawArc mapping: **F19** SVG (F19 says SVG "if the library supports it"). Decide: either embed fonts (network dependency at export time, larger files) or require web-safe fonts and skip inlining. Needs an owner decision.
- React Flow fit: app UI / server (if inlining is done on the server, the server needs font files).
- Priority: P2.
- Risks: export breaks offline or behind a CDN block (UNVERIFIED how the hosted app behaves when `esm.sh` is unreachable). Fonts are licensed; check before bundling.

**E4. Canvas size limits and error path** [editor]
- Observed: when the rasterised canvas is too big, `canvasToBlob` throws `CANVAS_POSSIBLY_TOO_BIG`, and the export dialog catches it and shows an error. The dialog also caps the preview at the container size.
- Evidence: `packages/excalidraw/data/blob.ts:239-260`; `packages/excalidraw/components/ImageExportDialog.tsx:156-170`.
- drawArc mapping: **F19** PNG export. Add a named error ("export too large: reduce scale or select a region") and cap the scale for big diagrams. F13 already caps node counts (2,000 nodes), which bounds the worst case.
- React Flow fit: app UI.
- Priority: P2.
- Risks: a 2,000-node canvas at scale 3 can exceed browser canvas limits; verify with the F15 perf seed (500 nodes).

**E5. Scene embedded in exported PNG (tEXt chunk) and SVG (base64 payload)** [editor]
- Observed: with `embedScene`, the PNG gets a `tEXt` chunk (keyword `application/vnd.excalidraw+json`) before `IEND`, holding the serialised scene encoded with `encode()` (zlib-compressed, optional encryption). SVG embeds the same JSON as base64 in a metadata element. `resaveAsImageWithScene` rewrites the file a user already saved as PNG or SVG with the scene.
- Evidence: `packages/excalidraw/data/image.ts:14-71` (`getTEXtChunk`, `encodePngMetadata`, `decodePngMetadata`); `packages/excalidraw/scene/export.ts:1042-1056` (SVG), `:1318-1330` (PNG); `packages/excalidraw/data/encode.ts:99-120`; `packages/excalidraw/data/resave.ts:12-49`.
- drawArc mapping: **new feature** under F19 (optional; "round-trip from picture"). Needs owner decision because it puts the full diagram into a file users share in documents and conflicts with F20 access rules (a shared PNG becomes a copy of the diagram without membership checks).
- React Flow fit: custom export logic.
- Priority: P3.
- Risks: privacy and data leakage. A shared image exposes all node text. Document this; default off.

**E6. Clipboard export: PNG, SVG text, and JSON** [editor]
- Observed: `exportToClipboard` supports `png` (image blob to clipboard), `svg` (serialised SVG text), `json` (elements plus files, written with the editor clipboard format). Paste reads the same formats back.
- Evidence: `packages/excalidraw/scene/export.ts:1384-1404`; `packages/excalidraw/components/ImageExportDialog.tsx:336` (copy PNG button); `packages/excalidraw/components/App.clipboard.ts` (paste path, not opened in full).
- drawArc mapping: **F19** (G-3 "PNG to paste into a document" is served better by copy-to-clipboard). New small item under F19, P2.
- React Flow fit: app UI (Clipboard API; browser permission).
- Priority: P2.
- Risks: Clipboard API permissions and Safari restrictions (UNVERIFIED for drawArc's target browsers).

**E7. Export only selected elements** [editor]
- Observed: the export dialog offers "only selected" when `isSomeElementSelected` is true. The export then uses the selection as the element set.
- Evidence: `packages/excalidraw/components/ImageExportDialog.tsx:74,227-232`.
- drawArc mapping: **F19** extension (P3) or a note in F19 non-goals. Reuse the F09/F10 selection model.
- React Flow fit: native (React Flow `getNodesBounds` on selected nodes).
- Priority: P3.
- Risks: edges whose endpoints are not selected need a rule (drop or keep).

### F. Import, open and paste

**F1. Open file replaces the scene; drop inserts at a position** [editor]
- Observed: the "Load" action (`loadScene`) runs `loadFromJSON`, which returns `elements` and replaces the current scene (`CaptureUpdateAction.IMMEDIATELY`). Dropping a `.excalidraw` (or PNG/SVG with an embedded scene) onto the canvas uses `loadFileToCanvas` with `insertPosition` and calls `addElementsFromPasteOrLibrary` (inserts, does not replace). Image files without a scene are inserted as images if the image tool is available.
- Evidence: `packages/excalidraw/actions/actionExport.tsx:394-420`; `packages/excalidraw/components/App.tsx:10768-10886` (drop handler), `:10920-10960` (`loadFileToCanvas`, error handling).
- drawArc mapping: **F19** currently specifies replace-only (import into a project). Propose two explicit modes: "replace canvas" (F14 flow, confirmation) and "insert into canvas" (new, lower priority). Owner decision.
- React Flow fit: app UI (drop zone on the React Flow container; `onDrop` must call `preventDefault`). Insert mode needs id remap (C2) and position offset.
- Priority: P2 (insert mode), P1 (replace mode already in F19).
- Risks: replace mode is destructive for everyone in the room; the F14 confirmation and broadcast apply.

**F2. Import error messages distinguish invalid file from image without scene** [editor]
- Observed: failures produce one of two alerts: `cannotRestoreFromImage` (image had no scene) or `couldNotLoadInvalidFile`. There is no field-level detail.
- Evidence: `packages/excalidraw/components/App.tsx:10926-10947`; `packages/excalidraw/data/blob.ts:200-218`.
- drawArc mapping: **F19** G-2 requires field-level messages. Excalidraw does not provide them; drawArc should map zod issues to paths (for example `nodes[3].position.x`). This is more than Excalidraw does.
- React Flow fit: app UI.
- Priority: P2.
- Risks: leaking internal paths in messages; keep them to canvas field names.

**F3. File-type detection by content, not extension** [editor]
- Observed: `loadSceneOrLibraryFromBlob` reads the file as text, tries `JSON.parse`, then checks `isValidExcalidrawData` and `isValidLibrary`. A non-JSON supported image is reported as "no scene". File handles are normalised with `normalizeFile` (`blob.ts:522`). The file-open filter is over-permissive (`json.ts:121-124`); how the picker and extension checks behave in `filesystem.ts` was not opened (UNVERIFIED).
- Evidence: `packages/excalidraw/data/blob.ts:140-199`; `packages/excalidraw/data/json.ts:121-124` (commented-out extension filter, iOS note).
- drawArc mapping: **F19**. Check the envelope `type` after JSON parse, not the extension; accept `.json` and the drawArc extension. Do not accept arbitrary files.
- React Flow fit: app UI.
- Priority: P2.
- Risks: a 4 MB JSON parse on the main thread (F19 cap) can freeze the UI; parse in a worker or bound the size before reading (F19 cap applied before read).

### G. Mermaid and text-to-diagram

**G1. Paste Mermaid text, converted to elements** [editor]
- Observed: on paste of plain text (not plain-text paste), if `isMaybeMermaidDefinition(text)` matches a chart keyword (`flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, and others), the editor dynamically imports `@excalidraw/mermaid-to-excalidraw`, calls `parseMermaidToExcalidraw`, converts skeletons with `convertToExcalidrawElements({ regenerateIds: true })`, and inserts at the cursor (desktop) or viewport centre (mobile). If the import fails (offline), it falls back to pasting text.
- Evidence: `packages/excalidraw/components/App.clipboard.ts:196-230`; `packages/excalidraw/mermaid.ts:2-15`; `packages/excalidraw/package.json:91` (dependency `3.0.0`).
- drawArc mapping: **new feature** (not in any drawArc feature). Closest existing: F17 AI design agent and F18 spec generation (M2/M3). Recommend a separate proposal, not F14 (templates are code-defined). Needs owner approval: new dependency (CLAUDE.md section 2) and a scope decision.
- React Flow fit: extra interaction logic (skeleton to node/edge conversion, auto layout is provided by Mermaid, not React Flow) plus server-free. Converting skeleton elements to React Flow nodes is custom code.
- Priority: P3 (valuable for system design diagrams, but not required by M1 or M2).
- Risks: Mermaid's bundle size (lazy-load it); layout differs from drawArc's own layout; regenerated ids (C2) must map to edges. Mermaid parsing of untrusted input runs in the browser; check its security model (UNVERIFIED for version 3.0.0).

**G2. Text-to-diagram dialog (AI, backend)** [editor] — UNVERIFIED backend
- Observed: `packages/excalidraw/components/TTDDialog/` has a Mermaid tab with a CodeMirror editor, preview, and a chat/text-generation hook (`hooks/useTextGeneration.ts`). The generation endpoint and auth were not located in this pass (grep for `fetch(` and the AI backend name in TTD files returned nothing). The package name `@excalidraw/mermaid-to-excalidraw` is loaded there too (`TTDDialog.tsx:54`).
- Evidence: `packages/excalidraw/components/TTDDialog/TTDDialog.tsx:50-150`; `packages/excalidraw/components/TTDDialog/hooks/useTextGeneration.ts:264`.
- drawArc mapping: overlaps F17 (AI design agent). Do not add now; it is AI-provider work that needs its own spec and provider decision (CLAUDE.md section 8 LLM rules apply).
- React Flow fit: server (AI call) plus app UI.
- Priority: P4 for this area.
- Risks: sending diagram content to a third-party model; privacy review required.

### H. Images and the `files` map

**H1. `files` map and `BinaryFileData` shape** [editor]
- Observed: the scene's binary data is a map `{ [fileId]: BinaryFileData }` where `BinaryFileData = { mimeType, id, dataURL, created, lastRetrieved? }`. Image elements reference it by `fileId` and carry `status: "pending" | "saved" | "error"`. File ids are content hashes of the file (`generateIdFromFile`). In the envelope, `files` is written only for local files.
- Evidence: `packages/excalidraw/types.ts:122-140`; `packages/excalidraw/data/blob.ts:263-277`; `packages/element/src/types.ts:160-170`; `dev-docs/docs/codebase/json-schema.mdx` (example, `files` section).
- drawArc mapping: none today (drawArc schema v1 has no image node, per the F06 summary; not fully checked). If image or icon nodes are added later, the file format needs a `files` map and content-hash ids; otherwise **skip**.
- React Flow fit: custom node (image node type) plus server (Blob storage of binaries).
- Priority: P3.
- Risks: inline `dataURL` makes the JSON large; a 4 MB cap per file with many images can exceed the 4 MB snapshot cap (F13). Store binaries in Blob and reference by id, as hosted does (H3).

**H2. Image size and resolution limits** [editor] and [hosted]
- Observed: editor default `maxFileSizeBytes` is 4 MiB and `maxWidthOrHeight` is 1440; files over the limit are rejected with a message, and oversized images are resized by `resizeImageFile`. Hosted upload cap is `FILE_UPLOAD_MAX_BYTES = 4 MiB`.
- Evidence: `packages/common/src/constants.ts:407-410`; `packages/excalidraw/components/App.tsx:10430-10446`; `packages/excalidraw/data/blob.ts:359-417`; `excalidraw-app/app_constants.ts:12`; `excalidraw-app/collab/Collab.tsx:183`.
- drawArc mapping: matches the F13 snapshot cap (4 MB) and F19 file cap (4 MB). Use the same constant for both and reject oversize before read.
- React Flow fit: app UI.
- Priority: P3.
- Risks: none if constants are shared.

**H3. Hosted: binary files in IndexedDB, orphan cleanup after 24 h** [hosted]
- Observed: hosted files live in IndexedDB (`files-db`). Each file has `lastRetrieved`. Cleanup runs over entries and deletes a file when it has no `lastRetrieved` or it was last retrieved more than 24 h ago, and it is not referenced by the current scene.
- Evidence: `excalidraw-app/data/LocalData.ts:49` (`createStore("files-db", "files-store")`), `:53-70` (`clearObsoleteFiles`); `packages/excalidraw/types.ts:129-137` (field docs).
- drawArc mapping: **F13** (Blob orphan sweep). drawArc has `deleteCanvas` but no orphan sweep for future binaries. Add to F13 only if images are introduced.
- React Flow fit: server (Blob sweep job, Trigger.dev candidate).
- Priority: P3.
- Risks: sweeping data a collaborator still references; use the room's current elements as the keep-list, as hosted does.

### I. Persistence and recovery (hosted)

**I1. Local autosave: 300 ms debounce into localStorage and IndexedDB** [hosted]
- Observed: `LocalData.save` debounces `_save` by `SAVE_TO_LOCAL_STORAGE_TIMEOUT = 300 ms`. It writes non-deleted elements to localStorage (`excalidraw`), the browser-scoped appState (`excalidraw-state`), and files to IndexedDB. Quota errors set a `localStorageQuotaExceededAtom` flag; the write is retried later.
- Evidence: `excalidraw-app/data/LocalData.ts:99-108,124-158`; `excalidraw-app/app_constants.ts:2,39-41`.
- drawArc mapping: **F13** keeps Blob autosave (30 s / 60 s). Excalidraw shows a local-draft layer is cheap; drawArc does not need one (Liveblocks is live truth and Blob is the durable copy). Do not add a localStorage draft without an approved reason (it would be a second authoritative copy, which data-ownership.md forbids).
- React Flow fit: app UI.
- Priority: P3 (decision only).
- Risks: a browser draft is not shared and can diverge; excluded by data-ownership.md principles.

**I2. Save pause while collaborating** [hosted]
- Observed: `LocalData.pauseSave("collaboration")` locks saving while a collaboration session is active (`Locker`). `save()` checks `isSavePaused()` synchronously before scheduling the debounced write, so a collaboration scene is not overwritten by stale local state. `resumeSave` releases the lock.
- Evidence: `excalidraw-app/data/LocalData.ts:122,160-175`; `excalidraw-app/data/Locker.ts:1-18`.
- drawArc mapping: **F13** G-5 ("a snapshot never overwrites live collaboration") is the same principle. Upgrade F13 acceptance to name the mechanism: a pause flag checked before the debounced write, not only at write time.
- React Flow fit: collaboration (Liveblocks status).
- Priority: P1 (supports an existing F13 requirement).
- Risks: a lock that is never released (crash, network drop) stops saves; add a timeout or release on room disconnect.

**I3. Cross-tab stamp so an older tab does not overwrite newer local state** [hosted]
- Observed: each save writes a timestamp to localStorage (`VERSION_DATA_STATE`, `VERSION_FILES`); `isBrowserStorageStateNewer` lets a tab compare its last-written stamp with the stored one. What the caller does on "newer" (reload, skip write) was not opened and is UNVERIFIED.
- Evidence: `excalidraw-app/data/tabSync.ts:1-39`.
- drawArc mapping: **skip** for the Blob snapshot (a single writer per room is already enforced by Liveblocks). Relevant only if drawArc adds a local draft (I1).
- React Flow fit: app UI.
- Priority: P4.
- Risks: none unless I1 is adopted.

**I4. Version snapshots and history** [hosted] — UNVERIFIED
- Observed: no version-history UI or server code was found in the open-source packages in this pass. Whatever the hosted app offers is UNVERIFIED.
- Evidence: not found in `excalidraw-app/data/` read so far.
- drawArc mapping: F13 non-goal (Liveblocks version history only, D-022). No change.
- React Flow fit: n/a.
- Priority: P4.
- Risks: none for this area.

### J. Libraries (format only)

**J1. `.excalidrawlib` format and dedupe** [editor]
- Observed: library file `{ type: "excalidrawlib", version: 2, source, libraryItems }`. Version 1 used `library` (array of element arrays); the parser accepts `libraryItems || library`. Items have `id`, `status` (`published`/`unpublished`), `elements`, `created`. Import dedupes by comparing element `versionNonce`s and hashing (`getLibraryItemsHash`).
- Evidence: `packages/excalidraw/data/json.ts:139-159` (`isValidLibrary`, `serializeLibraryAsJSON`); `packages/excalidraw/data/blob.ts:220-230` (`parseLibraryJSON`); `packages/excalidraw/data/library.ts:136-137,640-662`; `packages/excalidraw/data/types.ts:40-66`.
- drawArc mapping: **F14** templates and reuse. A drawArc "template library" file could reuse the F19 envelope. Owner decision; not required by F14 (code-defined templates).
- React Flow fit: native (nodes and edges as JSON).
- Priority: P3.
- Risks: two file formats to support (canvas and library). Prefer one envelope with a `kind` field if both are built.

---

## Could not verify

- Hosted app behaviour beyond the files listed: Firebase share links and room persistence (`excalidraw-app/data/firebase.ts` not opened), Excalidraw+ export, version history UI.
- Live UI of export dialogs, drop behaviour, and clear-canvas dialog text: no app was run, and no screenshot was opened.
- Output quality of PNG/SVG exports (fonts, colours, padding). Not rendered.
- `applyDarkModeFilter` colour mapping body (`packages/excalidraw/scene/export.ts`, call sites only).
- Offline behaviour of font inlining (`esm.sh` fallback) and of Mermaid lazy import.
- TTD (text-to-diagram) AI endpoint, auth, and data sent (`TTDDialog`, `useTextGeneration.ts` not fully read).
- `packages/utils/` export helpers and `packages/excalidraw/data/filesystem.ts` (not opened for this area).
- React Flow equivalents for PNG rasterisation, edge repair on setEdges, and zIndex semantics: Context7 or React Flow docs were not queried in this pass.
- Mermaid-to-excalidraw 3.0.0 security model for untrusted input.
- Browser clipboard support matrix for drawArc's target browsers.

## Top 10 recommendations for drawArc

1. **F19 envelope**: use a drawArc discriminator (`type`) and `schemaVersion` wrapping the F06 `CanvasDocument`; allow-list the persisted settings (no viewport, selection or UI state) (B1, B2).
2. **F19 import policy**: keep whole-file rejection with field-level messages (C3, F2) and never partially apply; keep a separate lenient path only for the owner's stored snapshots.
3. **Id policy**: keep ids on import when there is no collision in the target room; regenerate on collision and remap edge endpoints (C2). Shared with F14 instantiation.
4. **F13 migration**: key migrations on `schemaVersion`, one function per step, fixtures per version, and an explicit "unknown future version" rejection (B4, C4).
5. **Schema rule in F06**: write down "add optional fields with defaults, never repurpose a field" before the first schema change (D3).
6. **F19 PNG**: offer scales 1/2/3, a padding parameter, background toggle, and token-based dark mode (no colour inversion); add a named error for oversize exports (E1, E2, E4).
7. **F14 blank canvas**: add "blank canvas" as a replace option with confirmation and one batch and one undo step, using hard deletes, not soft-delete tombstones (A1).
8. **F13 save pause**: name the mechanism for G-5 (pause flag checked before the debounced write, with release on disconnect) (I2). Do not add a browser-storage draft; it would be a second authoritative copy (I1).
9. **F19 clipboard and selection**: add copy-as-PNG and export-selected as P2/P3 items (E6, E7). Defer embedded-scene PNG (E5) to an owner decision because of data leakage.
10. **Mermaid import and text-to-diagram**: record as a separate proposal, not inside F14 or F19. It needs an owner decision on the new dependency and scope (G1, G2).

Owner decisions needed before specs: SVG font strategy (E3), insert-mode import (F1), whether `source` is in the envelope (B1), and the Mermaid proposal (G1).
