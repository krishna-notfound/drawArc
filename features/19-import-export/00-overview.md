# F19 — Import / Export

| Field | Value |
|---|---|
| Milestone | Future |
| Depends on | F13 (persistence-and-recovery: `getCanvas`, `CanvasDocumentSchema` + migrations, snapshot caps), F14 (replace-canvas confirmation and `CANVAS_REPLACED` event), F06 (canvas schema v1) |
| Depended on by | — |
| Product requirements | — (no PRD assigned; a decision-log entry is required before specification, per product-requirements.md "Out of scope") |
| Status | see status.md |

## Purpose

Let a member take a canvas out of drawArc as a file (JSON for re-import, PNG/SVG for sharing in documents) and bring a JSON canvas back in. It sits after F13 because the only durable, validated representation of a canvas is the `CanvasDocument` that F13 already serialises, validates, migrates, and caps; import/export is a thin transport layer over that contract and must not introduce a second document format.

## Problem statement and goals

- Problem: a diagram currently lives only inside its project (Liveblocks room + Blob snapshot). Users cannot move a diagram between projects, back it up themselves, or embed a picture of it in a proposal or README.
- G-1: an owner/editor can download the current canvas as `drawarc-<project-name>-<YYYY-MM-DD>.json` that round-trips through import with identical node/edge count, ids, positions, sizes, labels, colours, and handles.
- G-2: an owner/editor can import such a file into a project; invalid or oversized files are rejected with a field-level message, never partially applied.
- G-3: any member can export a PNG (and, if the chosen library supports it, an SVG) of the whole diagram, framed to the node bounds, on the dark background with the same tokens the canvas uses.
- G-4: export/import authorization matches the existing capability table: export is `viewer+` (read), import is `editor+` (mutation).

## Scope

In scope:
- `GET /api/projects/[projectId]/canvas/export` — `requireProjectRole(projectId, 'viewer')`, reads the current room via `getStorageDocument` when the room is non-empty, else the Blob snapshot via F13 `getCanvas`; serialises with `lib/canvas/serialize.ts`; responds `Content-Type: application/json`, `Content-Disposition: attachment; filename="drawarc-<slugified name>-<date>.json"`.
- Import dialog (shadcn `Dialog`, file input + drop zone): client reads the file, parses JSON, runs `CanvasDocumentSchema.safeParse` and `migrateToCurrent` in `lib/canvas/schema.ts`, shows a summary (node/edge count, schema version) and the same destructive confirmation copy F14 uses, then applies.
- Server-side re-validation path: the import is applied through the same replace mechanism F14 uses (client mutation under an editor token); the next autosave re-validates on the server before `put`. No new write route is needed unless F14's replace path turns out to be server-side — align at specification time.
- Caps identical to security-model.md snapshot limits: file ≤ 4 MB, ≤ 2,000 nodes, ≤ 4,000 edges; above → rejected client-side with a message, and server-side with 422 on the next save.
- Image export: PNG at 2× device pixel ratio, framed to `getNodesBounds` with 40 px padding; SVG if the library supports it; file name `drawarc-<slug>-<date>.png|svg`.

Out of scope / non-goals:
- Importing non-drawArc formats (Excalidraw, Mermaid, draw.io) — never, unless a separate decision adds it.
- Exporting to PDF — never in this feature.
- Version history / multiple named snapshots — relies on Liveblocks version history (D-022); not this feature.
- Share-by-link of exported images — F20 covers public access; image files are the user's to share.

## User stories

- US-1: As an editor, I want to download my canvas as JSON so that I can keep a backup or move it into another project.
- US-2: As an editor, I want to import a JSON canvas into a project so that I can restore a backup or reuse a design.
- US-3: As a viewer, I want to export a PNG of the diagram so that I can paste it into a document without edit rights.
- US-4: As an editor importing a file from an old drawArc version, I want it migrated forward automatically so that old backups stay usable.
- US-5 (abuse): As a viewer I must not be able to import (the dialog is hidden and the server rejects the resulting save with 403); as a non-member I must not be able to export (`GET …/export` returns 403 with no existence leak, identical to F04's access-denied behaviour).
- US-6 (abuse): As an editor I must not be able to import a file that exceeds the caps or fails the schema, and a failed import must leave the current canvas untouched for every participant.

## Key design idea

**Import/export is a transport over the existing `CanvasDocument` contract, not a new format.** Export reuses F13's read path; import reuses F13's Zod schema and migrations and F14's "replace the canvas" mechanism (confirmation dialog → clear room → write nodes/edges → broadcast `{ type: 'CANVAS_REPLACED', byUserId }`). The only new code is a route handler, a dialog, and an image-capture helper.

Replace vs merge (decision to be made at specification):
- **Replace (PROPOSED default)** — identical semantics to F14 templates; one confirmation; room event already exists; no id-collision handling needed. Consistent with M1 behaviour.
- **Merge (option)** — every imported node and edge is re-identified (`${shape}_${ulid}` / `e_${ulid}`, edge endpoints remapped through the id map) and positions are offset to the right of the existing bounding box plus 80 px, so nothing overlaps. No confirmation. Requires the id-remap helper and a bounds computation; otherwise the same write path. Recommended as a second button ("Add to canvas") only if a user asks for it.

Image export candidates (**all UNVERIFIED — not researched on 2026-10-22**):
1. `html-to-image` `toPng(document.querySelector('.react-flow__viewport'), { backgroundColor, width, height, style: { transform } })` — the approach React Flow's "download image" example is believed to use; library version and React 19 compatibility UNVERIFIED.
2. `getNodesBounds(nodes)` + `getViewportForBounds(bounds, width, height, minZoom, maxZoom, padding)` from `@xyflow/react` for framing — believed to exist in v12 but not confirmed in the research notes (react-flow.md §8 does not list them); UNVERIFIED.
3. Native SVG serialisation of the viewport — edges are already SVG, but nodes are HTML (and our diamond/hexagon/cylinder are inline SVG inside HTML nodes), so a faithful SVG export needs `foreignObject` wrapping, which many SVG consumers do not render. Trade-off: PNG is reliable, SVG is lossy unless nodes are re-rendered as pure SVG.
4. Server-side rendering (headless browser or SVG renderer in a route) — **rejected**: unjustified infrastructure (principle 8) and duplicates node rendering.

## Key decisions referenced

- D-008 (node-and-edge editor; no non-node primitives) — export captures nodes/edges only.
- D-009 / D-022 — Blob snapshot is the durable copy; export reads it when the room is empty; no versioned snapshots in Blob.
- D-020 / F14 D-14d — after an import only the importer's viewport is fitted (the F06/FR-009 exemption for `hooks/useImportTemplate.ts`); other participants' viewports stay per-user.
- PROPOSED D-19x — "Import replaces the canvas (F14 semantics); merge is optional." Rationale: one confirmation path, no id-collision class of bugs, matches the mental model users already have from templates.
- PROPOSED D-19y — "Image export is client-side via an HTML-to-image library; SVG only if lossless." Rationale: no server rendering; the client already has the rendered DOM.

## Preconditions before this feature is specified

1. F13 is `verified`: `CanvasDocumentSchema`, `migrateToCurrent`, `getCanvas`, and the 4 MB / 2,000 / 4,000 caps exist and have L1 tests.
2. F14 is `verified`, so the replace-canvas mechanism and `CANVAS_REPLACED` event exist to be reused.
3. The owner records a decision-log entry adding import/export to scope (product-requirements.md requires one for anything outside recorded scope) and chooses replace-only vs replace+merge.
4. Research task: verify `html-to-image` (version, licence, React 19 behaviour with `next/font` CSS variables) and `getNodesBounds`/`getViewportForBounds` against reactflow.dev; record URLs and dates.
5. Decide whether PNG export of a 500-node canvas (NFR-004 fixture) completes in < 5 s on a mid-range laptop; if not, cap the exported area or node count.

## Reference material

- `context/domain-model.md` — Canvas schema v1, id format, migration rule.
- `context/security-model.md` — snapshot caps (4 MB, 2,000 nodes, 4,000 edges), "pathnames never from user input", Blob reads proxied.
- `context/data-ownership.md` — a non-empty room always wins; snapshot authoritative only when the room is empty.
- `context/ui-context.md` — dialog conventions, tokens for the export background.
- Research: react-flow.md §8 (viewport, `fitView`), §12 (serialisation, runtime fields to strip) — https://reactflow.dev/api-reference/types/react-flow-instance checked 2026-10-22; https://reactflow.dev/learn/troubleshooting/migrate-to-v12 checked 2026-10-22. Image-export libraries: UNVERIFIED.
- Reference prompts (`No_touch_ai/`): none cover import/export; F14 (`18-starter-templates.md`) is the closest pattern for "replace the canvas".
