# F14 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | `lib/canvas/templates.ts` shall export `CANVAS_TEMPLATES: readonly CanvasTemplate[]` with at least three entries with ids `microservices`, `cicd-pipeline`, `event-driven`, each `{ id, name, description, document: CanvasDocument }` where `document.schemaVersion === 1`, nodes use only `NODE_SHAPES`/`NODE_COLOR_IDS`, every node has `width`/`height`, every edge has `sourceHandle`/`targetHandle`, and `CanvasDocumentSchema.safeParse(document).success === true`. | must | PRD-028, US-6 | AC-001, AC-002 |
| FR-002 | Within each template no two node rectangles shall intersect after expanding each by 20 px on every side (minimum gap 40 px); every edge shall reference two distinct existing node ids; node and edge ids shall be unique within the document. | must | US-6, D-14c | AC-003 |
| FR-003 | `instantiateTemplate(template)` shall return a new `{ nodes, edges }` where every node id is `newNodeId(shape)`, every edge id is `newEdgeId()`, edge endpoints are remapped to the new node ids, `data` objects are fresh copies, and two consecutive calls share no id. | must | D-14b | AC-004 |
| FR-004 | The workspace navbar shall show an "Import" button (`lucide-react` `LayoutTemplate` icon, label "Import", `aria-label="Import a starter template"`) for owners and editors only; it opens the Import dialog. | must | PRD-028, US-1, US-5 | AC-005, AC-006 |
| FR-005 | The Import dialog (`rounded-3xl`, title "Starter templates", description "Pick a diagram to start from. Importing replaces the current canvas.") shall render one card per template in a responsive grid (1 column < 640 px, 2 columns ≥ 640 px, 3 columns ≥ 1024 px) with: an SVG preview (240 × 140 box), name, description, and an "Import" button (`aria-label="Import <name>"`); cards are keyboard reachable in order. | must | PRD-028, US-1 | AC-007, AC-008 |
| FR-006 | `TemplatePreview` shall be a pure SVG computed from node bounds (`viewBox` = union of node rects + 24 px padding, `preserveAspectRatio="xMidYMid meet"`): nodes drawn by shape (rect/rounded rect/circle/polygon) filled with `NODE_COLORS[color].fill` and stroked with `NODE_COLORS[color].text` at 1 px; edges as straight lines between node centres in `--text-faint`; no React Flow import, no labels. | must | PRD-028 | AC-009 |
| FR-007 | When the canvas has ≥ 1 node or edge, pressing a card's Import shall show a confirmation (`AlertDialog`): "Replace the current diagram?" / "This replaces the current diagram for everyone in this project. You can undo it." / Cancel / "Replace diagram" (destructive). When the canvas is empty, import proceeds without confirmation. | must | PRD-028, US-2, D-14f | AC-010 |
| FR-008 | Import shall execute as one `room.batch()`: `onDelete({ nodes: currentNodes, edges: currentEdges })` then `addNodes(instance.nodes)` then `addEdge(e)` for each edge; the result is one Storage message to others and one undo entry for the importer; collaborators never render an intermediate state with zero nodes between the old and new diagram. | must | PRD-028, US-3, US-4, D-14a | AC-011, AC-012 |
| FR-009 | Immediately after the batch the importer shall broadcast `RoomEvent { type: 'CANVAS_REPLACED', byUserId: self.id }`; every other participant shall show a toast "<Name> replaced the diagram with "<template name>"" with a "Fit view" action (name resolved from the room's `others` info or "Someone" if unresolved; template name is carried in the event — see 02-design for the type extension). The importer sees no toast. | must | US-4 | AC-013 |
| FR-010 | After the batch the importer's viewport shall be fitted once (`fitView({ duration: 200, padding: 0.2 })`); other participants' viewports shall not change. | must | D-14d | AC-014 |
| FR-011 | The dialog shall close after a successful import; `Escape`/Cancel close dialog and confirmation without changes; the Import button is disabled while an import is in flight (`aria-busy`). | should | US-1 | AC-010 |
| FR-012 | For viewers the Import button and dialog shall not render; `useImportTemplate().importTemplate` shall be a no-op; a forged write is rejected by the room (`*:read`, F05). | must | PRD-012, US-5 | AC-015 |
| FR-013 | One undo by the importer after import shall restore every previous node and edge (same ids, positions, sizes, data) and remove all template nodes/edges on every client. | must | US-3, D-013 | AC-016 |
| FR-014 | Each template shall be exported as a fixture file `tests/fixtures/canvas/templates/<id>.json` generated from source (a test asserts the fixture equals the source document) so F13 migration tests and F17 can reuse them. | should | testing-strategy "Test data" | AC-017 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-002 | Every template is parsed by `CanvasDocumentSchema` in a unit test (AC-002); the same schema guards the room/autosave boundary (F13). |
| NFR-003 | One batched message; TC-0xx records importer → collaborator render latency. |
| NFR-004 | Largest template ≤ 12 nodes / 14 edges — trivial; the preview is static SVG (no React Flow instance per card). |
| NFR-006 | Dialog/alert are Radix (focus trap, Esc); every button labelled; previews have `role="img"` + `aria-label="Preview of <name>"`; toast is `aria-live="polite"`. |
| NFR-007 | `CanvasTemplate` typed; templates built with typed helpers so a wrong shape/colour fails `tsc`. |

## UX and interaction behaviour

- **Entry point**: navbar, between Save status and Share (ui-context "Workspace" layout: "project name, Save status, Import template, Share, AI toggle"). Ghost button style, `h-5 w-5` icon.
- **Dialog**: `max-w-3xl`, scrollable grid (`ScrollArea`), cards `rounded-2xl bg-elevated border-surface-border` with hover `border-surface-subtle`; preview on top, name `text-copy-primary font-medium`, description `text-copy-muted text-sm` (≤ 120 chars), Import button `variant="secondary"` bottom-right.
- **Flow**: Import click → (confirm if non-empty) → batch → broadcast → fitView → close dialog → (no toast for self). Failure (room disconnected): the batch is queued locally like any mutation (liveblocks.md §8); the UI still closes; no error.
- **Toast (others)**: bottom-right, 6 s, text per FR-009, action "Fit view" calls `fitView({ duration: 200, padding: 0.2 })` for that user only.
- **Templates (content)** — all labels ≤ 24 chars, colours chosen for legend consistency (blue = services, teal = data stores, purple = messaging, orange = decisions/caches, green = deploy targets, red = failure paths, neutral = actors):

| id | name | description | nodes | edges |
|---|---|---|---|---|
| `microservices` | Microservices | API gateway in front of three services with their own databases and a shared cache. | 9 | 8 |
| `cicd-pipeline` | CI/CD pipeline | Commit → build → test → registry → staging → smoke test → production, with failure paths. | 9 | 10 |
| `event-driven` | Event-driven system | Producers publish to an event bus; consumers process, persist and dead-letter failures. | 10 | 11 |

- **Responsive**: grid columns per FR-005; dialog becomes full-height sheet-like on < 640 px (shadcn default responsive dialog is acceptable).
- **Reduced motion**: `fitView` duration 0 when `prefers-reduced-motion`.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | B is editing a label (F08) when A imports | B's node is removed in the batch; B's editor unmounts without a write (F08 FR-010); B sees the toast; no error | AC-018 |
| EC-002 | Viewer somehow calls `importTemplate` (devtools) | No-op in the hook; a hand-rolled write is rejected by the room (read token) | AC-015 |
| EC-003 | A template fails `CanvasDocumentSchema` or overlaps at build time | Unit test fails → `npm run check` red → CI blocks | AC-002, AC-003 |
| EC-004 | Importer presses undo after import | Previous canvas restored for everyone (one entry); redo re-applies the template | AC-016 |
| EC-005 | Two users import different templates within 200 ms | Server order decides and both batches apply in sequence. Each `onDelete` lists only the nodes its author saw at click time, so if the second batch was computed before the first arrived, the final canvas contains both templates' nodes; otherwise only the later template. Documented M1 limitation; no crash; both clients converge | AC-019 |
| EC-006 | Import while offline | Batch queued; applied locally; sent on reconnect; toast reaches others then | AC-020 |
| EC-007 | Canvas has 500 nodes when importing | Single batch; completes < 1 s locally; no partial state | AC-011 (fixture variant) |
| EC-008 | Dialog opened, then role downgraded to viewer (KICK/re-auth) before Import is pressed | `importTemplate` no-op; dialog closes on role change | AC-015 (unit) |
| EC-009 | Template edge references a missing node (authoring error) | Caught by the unit test (FR-002), never at runtime | AC-003 |
| EC-010 | `CANVAS_REPLACED` received by a client that is mid-drag of a now-deleted node | React Flow drops the drag for a missing node; no error | AC-018 (console check) |
