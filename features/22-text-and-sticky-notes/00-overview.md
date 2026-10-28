# F22 — Text and sticky notes

| Field | Value |
|---|---|
| Milestone | M1.5 — canvas richness (post-M1 batch 1, research `00-summary.md` §5) |
| Depends on | F06 (schema v1 frozen, hook pipeline), F07 (palette, `useCanvasMutations`, `newNodeId`), F08 (label editor, `NodeResizer`; **F08 v2** properties toolbar FR-024 hosts the text options — FR-016 dependency note), F10 (shortcut matching, `isEditableTarget`), F13 (`migrate` → `validateDocument` on PUT/GET/seed), F14 (templates validated by the shared Zod schema) |
| Depended on by | F21 (`freehand` kind), F23 (`locked`, `groupId`, `order`, `frame`), F24 (`image`), F28 (`line`), F09 upgrade (`edge.data.style`), F08 upgrade (`data.text`, `data.border`, hex picker), F19 (envelope carries `schemaVersion: 2`) |
| Product requirements | PRD-021 (node creation), PRD-023 (inline text), PRD-024 (colour), PRD-030 (document validation); NFR-003, NFR-004, NFR-006 |
| Status | see status.md |

## Purpose

F22 turns the node-and-edge canvas into a whiteboard surface (D-052): a borderless **text** node for free annotations and a filled **sticky note** for whiteboarding, both edited with the F08 label editor. It is also the one feature that ships **canvas schema v2** (D-057): a single migration that reserves every field later features need (`line`, `freehand`, `frame`, `image` kinds, `data.text`, `data.border`, `locked`, `groupId`, `order`, `href`, image refs, `edge.data.style`, hex colours) so F21/F23/F24/F28 and the F08/F09 upgrades add behaviour without another bump.

## Problem statement and goals

- Problem: every annotation today must be a shape with a fill and a border; there is no way to drop a sentence beside a diagram or a quick note on a whiteboard (R-005, R-006). Separately, five queued features each need a schema change; bumping per feature multiplies migration, fixture and validator work (research §2 C1).
- G-1: pressing T, typing a sentence and clicking away leaves a text node sized to its content, visible to collaborators within 1 s.
- G-2: pressing N gives a 250 × 250 note in a palette or hex colour with legible text (≥ 4.5:1).
- G-3: every v1 snapshot and template loads unchanged through `migrateV1ToV2`; the v2 Zod schema validates all ten kinds and every reserved field, so later features touch only UI and behaviour.
- G-4: text/sticky editing keeps F08 semantics (Enter commits, Esc cancels, one undo entry per commit) and never leaves an invisible empty node behind.

## Scope

In scope:
- Canvas schema v2: `types/canvas.ts`, `lib/canvas/schema.ts` (`migrateV1ToV2`, discriminated union on `data.shape`), `lib/canvas/color.ts` (palette id or hex, derived text colour), fixtures, template fixtures regenerated, F13/F14 tests moved to v2.
- Text node (`shape: 'text'`): T key / palette item; auto-width single or multi-line; resize to fixed width with wrapping; no border, no fill, no handles; font size, alignment, bold; empty node deleted on blur.
- Sticky note (`shape: 'sticky'`): N key / palette item; 250 × 250, min 75 × 75, resizable; wraps, grows in height on commit; palette or hex fill; four handles; subtle shadow.
- Text-option contract for the shared properties toolbar: `TEXT_OPTION_KINDS`, `DEFAULT_TEXT`, `TEXT_SIZE_PX`. F08 v2 (FR-024) owns the single properties toolbar (colour · border · text size · align) for every kind; F22 ships no toolbar component (validation ruling 2026-10-28).
- Placeholder rendering for reserved kinds written by a newer client.

Out of scope / non-goals:
- UI for `line`, `freehand`, `frame`, `image` → F28, F21, F23, F24 (validated only here).
- `locked`, `groupId`, `order` behaviour → F23; `href` UI → F08 upgrade (R-051); `data.border` and `data.text` UI on the six shapes, hex colour picker and recent colours → F08 upgrade (R-027, R-028, R-031); `edge.data.style` UI → F09 upgrade (R-025, R-026).
- Rich text, markdown, links in text, fonts other than Geist, vertical-align UI (field reserved; default per kind) → never / later.
- Live per-keystroke sync and "X is editing" presence → F11 upgrade (R-040).
- A canvas "tool mode" (press T, then drag on the pane to size the text) → not adopted; see D-22b.

## User stories

- US-1: As an editor, I want to press T and type so I can annotate a diagram without choosing a shape.
- US-2: As an editor, I want a text block to grow as I type and wrap once I give it a width.
- US-3: As an editor, I want to press N for a sticky note, pick its colour and resize it, so I can whiteboard ideas.
- US-4: As an editor, I want text and notes to behave like any node (select, move, delete, undo, duplicate, sync).
- US-5: As a collaborator, I want to see the final text and size the author committed, at the same size they see it.
- US-6: As a project owner, I want my v1 snapshots and templates to open exactly as before after the upgrade.
- US-7: As a viewer, I must not be able to create, edit or restyle text or notes.
- US-8 (failure): As an editor who pressed T by accident and clicked away, I want nothing left on the canvas.

## Key decisions referenced

- D-052 (whiteboard scope), D-053 (Esc cancels), D-056 (`order` fractional string), D-057 (schema v2 lands once), D-063 (palette or hex, contrast guard), D-013/D-014 (per-client undo, per-key LWW), F08 D-08a (commit-on-close).
- **PROPOSED D-22a — One React Flow node type.** All kinds keep `type: 'canvasNode'` and `CanvasNode` dispatches on `data.shape`. Rationale: `nodeTypes`, serialisers, F13/F14 and `useCanvasMutations` stay untouched; `shape` is already the discriminator in v1 and is never repurposed (research `04` §D3).
- **PROPOSED D-22b — Fixed-width text comes from resizing, not from a drag tool.** Creation is always auto-width; dragging a side handle sets `autoWidth: false` and the width. Rationale: drawArc's pane drag is box-select and the palette drag is drop-to-place; a drag-to-size tool mode would be a new interaction model (R-047 is P3).
- **PROPOSED D-22c — Text nodes have no handles; sticky notes have four.** A text node is an annotation: its size changes with every edit, which would move handle positions and edges, and a label glued to an edge end is what edge labels (F09) are for. A sticky is a fixed box that often *is* a diagram participant ("note → service"), so it keeps F07's handle set. Zod rejects edges whose endpoint is a handle-less kind.
- **PROPOSED D-22d — Reserved fields are optional; absent means the kind's default.** `order` absent sorts lowest (as `''`); F23 adds keys without a migration. Keeps `migrateV1ToV2` a pure version stamp and keeps `fractional-indexing` out of F22.
- **PROPOSED D-22e — Sticky default colour is palette `orange`**; font sizes `s/m/l/xl` = 12/14/20/28 px, default `m` for every kind.

## Reference material

- `context/domain-model.md` "Canvas schema v1" (change rule), `context/ui-context.md` (palette, handles, a11y), `context/testing-strategy.md` "Test budget", `context/decision-log.md` D-052–D-065.
- Research (2026-10-27, Excalidraw `14bb42e`, code-read, visuals UNVERIFIED): `00-summary.md` §2 C1 (v2 field list), C2 (`order`), C6 (T/N reserved), R-005, R-006, R-008, R-027, R-031; `01-selection-tools-text.md` §T6 (auto-width vs fixed-width, `autoResize`), §T10 (250 px default, 75 px min, 16 px min font), §R4 (auto-grow), §X6/§X7 (align defaults), §X9 (font size), §X10 (DOM measurement avoids canvas-measure failures); `02-…` §F-A03 (marker kinds); `03-…` §F-41 (hex + legible text); `04-…` §B4/§D3 (migration rules).
- Style models: `features/08-node-editing/`, `features/07-shapes-and-node-creation/01-requirements.md` + `02-design.md`; F21 overview (freehand field shapes folded into v2).
