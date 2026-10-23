# F14 — Starter templates

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F07 (node shape/sizes, `useCanvasMutations.addNodes`, `newNodeId`), F09 (edge shape, `newEdgeId`, `onDelete`), F06 (`CanvasDocument`/`CanvasDocumentSchema`, hook pipeline, role prop), F04 (workspace navbar slot), F05 (`RoomEvent` typing, `useBroadcastEvent`/`useEventListener`) |
| Depended on by | F13 (template fixtures double as snapshot fixtures), F15 (M1 acceptance run step 7), F17 (agent output validated by the same schema; may seed from a template) |
| Product requirements | PRD-028 (replace the canvas with one of ≥ 3 templates after confirmation); contributes to PRD-012, PRD-030, NFR-002 |
| Status | see status.md |

## Purpose

F14 lets a user start from a recognisable architecture instead of a blank canvas. Three code-defined canvas documents (microservices, CI/CD pipeline, event-driven system) are shown in an Import dialog with a lightweight SVG preview; importing one replaces the whole canvas for everyone in the room in a single collaborative step, tells the other participants who did it, and fits the importer's viewport once. It depends on F07 and F09 because templates are made of exactly the nodes and edges those features define, and it is the first feature to exercise `CanvasDocumentSchema` against non-trivial data.

## Problem statement and goals

- Problem: the reference prompt (`18-starter-templates.md`) cleared and re-added nodes in two separate operations, producing two undo steps and two remote messages (a flash of an empty canvas for collaborators), put template data under `components/`, and gave no rule against overlapping nodes or colliding ids on repeated imports.
- G-1: an import is one Liveblocks message and one undo step for the importer; collaborators never see an intermediate empty canvas.
- G-2: every template validates against `CanvasDocumentSchema` in CI, uses only schema-v1 shapes/colours, and has no overlapping nodes (gap ≥ 40 px).
- G-3: importing the same template twice (or two users importing) never produces duplicate ids.
- G-4: other participants see a toast naming who replaced the diagram within 1 s; viewers cannot import (UI hidden; token rejects).
- G-5: the importer's undo restores the previous canvas exactly.

## Scope

In scope:
- `lib/canvas/templates.ts`: `CanvasTemplate` type, `CANVAS_TEMPLATES` (≥ 3), layout helpers, `instantiateTemplate(template)` (fresh ids).
- `components/editor/import-template-dialog.tsx`: navbar "Import" button → Dialog with card grid, SVG preview, name/description, Import button, confirmation step when the canvas is non-empty.
- `components/editor/template-preview.tsx`: pure SVG from node bounds (no React Flow instance).
- `hooks/useImportTemplate.ts`: confirmation state, one-batch replace via the hook pipeline, `CANVAS_REPLACED` broadcast, `fitView` once.
- `components/canvas/canvas-replaced-toast.tsx`: `useEventListener` → toast for other participants.
- Unit tests validating every template (schema, non-overlap, id uniqueness), fixtures in `tests/fixtures/canvas/templates/`.

Out of scope / non-goals:
- User-saved/custom templates, template persistence, template thumbnails as images → F19 or later. Merging a template into an existing canvas (additive import) → never in M1 (PRD-028 says "replace"). Importing arbitrary JSON files → F19. Template-specific colours/shapes outside schema v1 → never.

## User stories

- US-1: As an editor, I want to pick a starter diagram from a dialog with a preview so I can begin from a familiar architecture.
- US-2: As an editor with existing work, I want to be warned that importing replaces the diagram for everyone before it happens.
- US-3: As the importer, I want one undo to bring back what was there before.
- US-4: As a collaborator, I want to see the new diagram appear at once (not an empty flash) and be told who imported it.
- US-5: As a viewer, I must not see the Import button, and a forged import must be rejected by the room.
- US-6: As a maintainer, I want CI to fail if a template breaks the schema or overlaps nodes.

## Key decisions referenced

- D-012, D-013, D-020, F07 D-07a, F09 D-09c (no `markerEnd` on persisted edges), domain-model rules "Templates … must validate against the same Zod schema" and id formats.
- **PROPOSED D-14a — Import = one `room.batch()` containing `onDelete({ nodes: all, edges: all })` followed by `addNodes(templateNodes)` and `addEdge` for each template edge.** Rationale: `room.batch()` sends one message and records one undo step (liveblocks.md §2, S19); `onDelete` already cascades edges atomically (liveblocks.md §1). Fallback if the hook's handlers cannot be batched synchronously (F07/F08 T-001 outcome): `useHistory().pause()` … `resume()` for the single undo step; collaborators may then see two messages (accepted and documented).
- **PROPOSED D-14b — Template documents in source have deterministic ids (`rectangle_T1N01`-style) for readability and fixture stability; `instantiateTemplate` regenerates every id with `newNodeId`/`newEdgeId` at import time and remaps edge endpoints.** Source ids are never written to a room.
- **PROPOSED D-14c — Layout grid: columns every 280 px, rows every 200 px, node top-left at the grid point; with max default size 180 × 140 this guarantees ≥ 100 px horizontal and ≥ 60 px vertical clearance. The unit test enforces a stricter general rule: no two node rectangles intersect after expanding each by 20 px (gap ≥ 40 px).**
- **PROPOSED D-14d — After import only the importer's viewport is fitted (`fitView({ duration: 200, padding: 0.2 })`); other participants keep their viewport and get a toast with a "Fit view" action.** Never move a user's viewport without their action (consistent with F07's no-fit-on-drop rule).
- **D-14e — Toasts use shadcn `sonner`** (`components/ui/sonner.tsx`, generated by F05 for its connection toasts and reused here; F14 generates only `alert-dialog`).
- **PROPOSED D-14f — Confirmation copy**: title "Replace the current diagram?", description "This replaces the current diagram for everyone in this project. You can undo it.", buttons "Cancel" / "Replace diagram" (destructive variant). Shown only when the canvas has ≥ 1 node or edge.

## Reference material

- `context/domain-model.md` canvas schema v1 and rules (templates validate; ids), `RoomEvent` union (`CANVAS_REPLACED { byUserId, templateName? }`); `context/data-ownership.md` (templates live in source; room is live truth); `context/ui-context.md` (navbar "Import template", dialogs `rounded-3xl`, destructive confirmations, palette); `context/project-overview.md` M1 acceptance run step 7; `context/security-model.md` (viewer `*:read`).
- Research `research/liveblocks.md` §1 (hook handlers, `onDelete` atomic), §2 (`room.batch()` one message + one undo step; `useMutation` batching), §3 (`history.pause/resume`; per-client), §4/§5 (`broadcastEvent`/`useEventListener` and read tokens) — checked 2026-10-22. `research/react-flow.md` §8 (`fitView` instance method with `duration`/`padding`; 12.5.0 fixed `fitView` right after adding nodes), §12 (persisted node fields) — checked 2026-10-22.
- Reference prompt (intent only): `No_touch_ai/.../18-starter-templates.md`.
