# Excalidraw research — prioritised findings summary

Status: **Awaiting Owner Input**. Planning document only; nothing here is approved or specified. Written 2026-10-28 by the spec-writer from the six research files below. No code, no commits.

## 1. Scope and method

- Sources: `01-selection-tools-text.md`, `02-arrows-groups-snapping-images-library.md`, `03-editing-productivity.md`, `04-document-workflows.md`, `05-collaboration.md` (all against excalidraw/excalidraw commit `14bb42e`, 2026-10-27, shallow clone, code reading only) and `../landing-and-auth.md` (Clerk docs via context7, Next 16 bundled docs, repo state). No live Excalidraw app was run; no screenshots were opened except one marketing mock (`05` §A3). Every visual claim stays UNVERIFIED (§7).
- Baseline: F00–F15 implemented and merged (`context/progress-tracker.md`); F16–F21 drafted. Canvas schema v1 = six shapes, `{ label, shape, color }`, four handles (`context/domain-model.md`).
- Fixed owner decisions (2026-10-28) applied throughout: personal daily tool for architecture diagrams **and** whiteboarding, editing speed and feel first; text node and sticky note are new node kinds (schema v2); sketchy style is P3 only; landing page at `/` and zero-branding custom Clerk UI are wanted (overrides F02 FR-005 and the reference "keep Clerk default user menu" rule); AI (F16–F18) calls the owner's gateway through one env-configured adapter (constraint only); drawArc rules win over Excalidraw where they conflict (Esc cancels, strict import rejection, hard delete).
- Dedup rule: one row per capability, citing every file§finding that contributed. Effort: S ≤ 1 agent-day, M 2–4, L ≥ 5.

## 2. Cross-cutting decisions needed once

### C1. Canvas schema v2 — one migration, not five

Five research areas each want a schema change (text/sticky nodes, groups/lock/z-order, edge style, node text options, image refs) and the F21 draft already claims "v2" for freehand. Doing these as separate bumps means five migrations, five fixture sets and five F13/F14/F17 validator updates.

| Option | Description | Trade-offs |
|---|---|---|
| A — single v2 (recommended) | One `migrateV1ToV2` adding only **optional** fields with defaults; `CanvasNodeData` becomes a discriminated union on `shape`; v1 documents load unchanged. Fields reserved now even if the feature ships later. | One approval, one fixture set, one validator change. Risk: reserved fields for features that never ship (cheap; they are optional). |
| B — bump per feature | v2 text/sticky, v3 groups, v4 edges… | Each bump touches F13 migrations, F14 templates, F17 `DesignPlan` validator, F19 envelope; more review cycles; higher regression surface. |

Proposed v2 shape (to be finalised in the first spec that lands; all new fields optional):

```ts
// nodes
NODE_SHAPES += 'text' | 'sticky' | 'frame' | 'image' | 'freehand'   // F22, F23, F24, F21
data.text?:   { size: 's'|'m'|'l'; align: 'left'|'center'|'right'; valign: 'top'|'middle'|'bottom' }   // F08 upgrade, F22
data.border?: { style: 'solid'|'dashed'|'dotted'; width: 1|2|3 }                                        // F08 upgrade
data.locked?: boolean                                                                                   // F23
data.groupId?: string                                                                                   // F23 (tag model, see Q7)
data.order?:  string            // fractional index → derived zIndex at render                           // F23 (see C2)
data.href?:   string                                                                                    // F08 upgrade (P3)
data.fileId?: string; data.status?: 'pending'|'saved'|'error'; data.natural?: { w, h }                  // F24
data.points? / data.strokeWidth?                                                                        // F21 (as drafted)
node.parentId? / node.extent?: 'parent'   // React Flow top-level fields, persisted for 'frame' children // F23
// edges
data.style?: { kind: 'smoothstep'|'bezier'|'straight'|'step'; stroke: 'solid'|'dashed'|'dotted'; width: 1|2|3;
               markerStart?: MarkerKind; markerEnd?: MarkerKind }                                       // F09 upgrade
```

Rules carried from research: add optional fields with defaults, never repurpose a field (`04` §D3); migrations keyed on `schemaVersion`, one function per step, reject unknown future versions (`04` §B4); passthrough on read only, strict on write (`04` §C1). **Recommendation: A.** Decision Q6.

### C2. Z-order sync (`@liveblocks/react-flow` does not sync `zIndex`)

| Option | Description | Trade-offs |
|---|---|---|
| A — `data.order` fractional index (recommended) | Store a fractional-index string in synced node `data`; derive React Flow `zIndex` by rank in a memoised selector. Bring-forward/back writes one node; two users reordering concurrently get distinct keys (`02` §F-Z01, `05` §C3, `04` §D2). | Needs `fractional-indexing` (MIT, zero deps, ~1 KB) or a ~40-line local midpoint function; repair step for duplicates on load. |
| B — numeric `data.zIndex` | Integer; "to front" = max+1; renumber when gaps run out. | "Send backward" between neighbours forces renumbering many nodes = many Liveblocks writes and LWW clashes. |
| C — no z-order | Creation order + `elevateNodesOnSelect`. | Zero cost; but sticky notes, frames and images make overlap routine, so the owner will hit it daily. |

**Recommendation: A**, scoped to F23; frames always rank below their children. Decisions Q4 (approach) and Q5 (dependency).

### C3. Clipboard format

Browsers do not reliably accept custom MIME types in `navigator.clipboard.write`, so Excalidraw writes JSON as `text/plain` (`02` §F-C01). Recommend the same: `{ type: 'drawarc/clipboard', schemaVersion, nodes, edges }` as text; on paste try `JSON.parse` → Zod → re-id (`newNodeId`/`newEdgeId`) → remap edge endpoints → drop edges with a missing endpoint → offset so the group's bounding-box centre lands at the pointer (`screenToFlowPosition`) or viewport centre when the pointer is off-canvas. Non-drawArc plain text pastes as a text node once F22 exists. Keep an in-memory fallback copy for when clipboard read is denied. Cut = copy + one batched delete. The same helper serves duplicate (F10 FR-007), F25 library insertion and F19 insert-mode import.

### C4. Dependency approvals (CLAUDE.md §2)

| Package | For | Recommendation |
|---|---|---|
| `fractional-indexing` | C2 z-order | Approve with F23 (or hand-roll; see C2). |
| `html-to-image` (or `modern-screenshot`) | F19 PNG export of the React Flow viewport | Approve with F19 after a one-hour spike on React 19 + `next/font` variables (F19 precondition 4 already asks for this). |
| `perfect-freehand` | F21 | Already in the F21 draft; approve with F21. |
| `mermaid` (+ layout) | Mermaid import | Defer (P3); large bundle, lazy-load only; decide when scheduled (Q10). |
| `roughjs` | Sketchy style | Defer (P3); no change now. |
| No new Clerk packages | F27 custom flows use `useSignIn`/`useSignUp` from `@clerk/nextjs ~7.9.20`, already installed. | — |

### C5. Conflict policy and local-interaction guard

Liveblocks per-field LWW (D-014) is already finer than Excalidraw's element-level reconcile (`05` §D3). Add two explicit rules to the specs that touch it: (1) while a node is `dragging`/resizing locally, remote position/size for that node is not applied until the gesture ends (`05` §D2, §C2); (2) label editing publishes `presence.editingNodeId` and shows "X is editing" — advisory only, last commit wins (`05` §D1). Record as a decision when the F08/F11 upgrades are approved; no architecture change.

### C6. One shortcut registry before adding ~25 shortcuts

Research proposes ~25 new keys (letters for shapes, Ctrl+C/X/V, Ctrl+G, Ctrl+Shift+L, Ctrl+[ ], Ctrl+Shift+Arrow, Alt+S, Ctrl+', Shift+2, Ctrl+F, Ctrl+Alt+C/V…). Excalidraw cancels an action when two `keyTest`s match (`03` §F-16). Recommend a single `lib/shortcuts/registry.ts` that drives the window listener (F10 FR-004), the cheat-sheet (FR-010), context-menu `<kbd>` hints and `aria-keyshortcuts`, with a unit test that fails on duplicate bindings. Reserve letters now: R rectangle, D diamond, O circle, P pill, C cylinder, H hexagon, T text, N sticky, F frame (F23), X freehand (F21), I image (F24), Q sticky-tool (P3). Part of the F10 upgrade; ships first.

### C7. Spec changes implied by the fixed decisions

- F02 FR-005 (`/` redirects by session) → replaced by F26 landing page; F02 FR-003/FR-004 (prebuilt `<SignIn/>`/`<SignUp/>`, "no hero") and FR-006 (`UserButton`) → superseded by F27; reference `03-auth.md` rule "keep Clerk's default user menu" → recorded as overridden in `context/decision-log.md`. The F04/F11 `PresenceStack` slot contract changes to accept the custom menu (`landing-and-auth` §F-6).
- F16/F17/F18: provider adapter is env-configured (`AI_WIRE_FORMAT`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`) serving Anthropic and OpenAI wire formats through one interface; nothing else in M2 changes here.

## 3. Prioritised findings table

Columns: ID · capability · behaviour · evidence · mapping · React Flow fit · priority · effort · notes/risks. "Done" = already shipped in F00–F15 (verify only).

### P1 — daily essentials

| ID | Capability | One-line behaviour | Evidence | Mapping | RF fit | Pri | Eff | Notes / risks |
|---|---|---|---|---|---|---|---|---|
| R-001 | Copy / cut / paste nodes+edges | Ctrl+C/X/V with JSON clipboard (C3); re-id, edge remap; paste at pointer, keeps relative layout; pane menu gets Paste | 02§F-C01,C03,C06; 03§F-11,F-28 | Upgrade F10 | custom logic | P1 | M | Validate pasted JSON with Zod; viewers no-op; biggest gap today |
| R-002 | Grid snap + grid background | Ctrl+' toggles 20 px grid; drag snaps to grid; `<Background variant="lines">` | 02§F-S03; 03§F-53 | Upgrade F06/F10 | native (`snapToGrid`, `snapGrid`) | P1 | S | Grid colour token (dark-only); per-user preference in localStorage, not storage |
| R-003 | Align selection | Ctrl+Shift+Arrow aligns left/right/top/bottom; centre H/V from menu/panel; one undo entry | 02§F-S05; 03§F-24,F-38 | Upgrade F10 | custom (`getNodesBounds` + batched `setNodes`) | P1 | S | Batch write so one Ctrl+Z reverts |
| R-004 | Distribute selection | Equal spacing H/V for ≥ 3 nodes | 02§F-S06; 03§F-24 | Upgrade F10 | custom | P1 | S | Pair with R-003 |
| R-005 | Standalone text node | T key / palette: click creates auto-width text; drag creates fixed-width wrapping text; no border/fill; DOM-measured size | 01§T6,X9,X10 | **New F22** | custom node | P1 | M | Schema v2 (`shape:'text'`, `data.text`); handles optional (decide in spec) |
| R-006 | Sticky note node | N key / palette: click creates 250 px filled square note; min 75 px; text wraps; colour from palette | 01§T10 | **New F22** | custom node | P1 | S | Schema v2 (`shape:'sticky'`); same label editor as F08 |
| R-007 | Shift keeps aspect on resize | Holding Shift during a resize keeps aspect for any shape | 01§T4 | Upgrade F08 | native prop + key listener | P1 | S | Apply only while a resize handle is active to avoid the Shift box-select conflict |
| R-008 | Auto-grow node to fit label | Node height grows to fit text (up to a cap) instead of clamping at 5 lines; width fixed by user | 01§R4,X10 | Upgrade F08 | custom (measured dims → height write) | P1 | M | Changes FR-014 clamp; use DOM measurement; one write per commit, not per keystroke |
| R-009 | Keyboard shape insertion | Letter keys (C6 reserved set) insert that node at pointer/centre; Esc cancels; keys ignored in inputs | 01§T1; 03§F-20 | Upgrade F07 + F10 | app UI | P1 | S | Needs C6 registry; follows F07 FR-007 placement |
| R-010 | Zoom to selection + % readout | Shift+2 fits selected nodes; control bar shows "100 %", click resets to 100 %; buttons disabled at min/max | 03§F-49,F-50 | Upgrade F10 | native (`fitView({ nodes })`) | P1 | S | Match on `event.code`; one label per action |
| R-011 | Shortcut registry, conflict test, hints | Single registry drives keymap, cheat-sheet, `<kbd>` hints, `aria-keyshortcuts`; test fails on duplicate keys | 03§F-15,F-16,F-18,F-29,F-59 | Upgrade F10 | app UI | P1 | S | Foundation for every other shortcut row (C6) |
| R-012 | Undo set made explicit | Undo covers node/edge data + positions only; selection and viewport never; shortcut is a no-op mid-gesture; sync/system writes never create entries; remote changes do not clear redo | 03§F-02,F-03,F-04,F-06,F-08; 05§F1,F2 | Upgrade F10 AC (doc + tests) | collaboration | P1 | S | Mostly already true via Liveblocks; write it down and test it |
| R-013 | PNG export + copy as PNG | Export whole canvas or selection at 1×/2×/3×, padding, dark tokens; named error when too large; Shift+Alt+C copies PNG | 04§E1,E4,E6,E7; 02§F-C05; 03§F-12 | **F19 fill** | custom (html-to-image) | P1 | M | Spike on React 19 first (C4); 2,000-node × 3× may exceed canvas limits |
| R-014 | JSON export/import contract | Envelope `{ type:'drawarc-canvas', schemaVersion, settings, nodes, edges }`; no viewport/selection; whole-file rejection with field paths; keep ids unless collision; migrate by version | 04§B1,B2,B4,C1,C2,C3,F2,F3 | **F19 fill** | native | P1 | M | Replace mode first; insert mode is Q8 |
| R-015 | Landing page at `/` | Static hero + feature grid + how-it-works + CTA; metadata, OG image, sitemap, robots; no `auth()` at top level | LA§F-10,F-11 | **New F26** | app UI | P1 | M | Supersedes F02 FR-005; copy must only claim shipped features |
| R-016 | Custom sign-in / sign-up / forgot password | `useSignIn`/`useSignUp` flows: email+password, email code, device trust (`needs_client_trust`), reset; our pages, our copy, zero Clerk badge | LA§F-1,F-2,F-4,F-7,F-9 | **New F27** | app UI | P1 | L | Keep server gate and `proxy.ts`; OAuth optional (Q11); E2E with two users |
| R-017 | Custom user menu | Replace `UserButton` with `useUser` + `signOut({ redirectUrl:'/' })` menu passed through the `PresenceStack` slot | LA§F-5,F-6 | **New F27** (touches F04/F11 slot) | app UI | P1 | S | Profile/password editing needs own screens or `openUserProfile` (branded) — spec decides |
| R-018 | Connection status + offline UX | Pill for reconnecting/disconnected/syncing; lost/restored toasts | 05§E1 | **Done** F05 FR-011 | native | P1 | — | Verify only; Excalidraw has less |
| R-019 | Offline edits replay | Edits made while disconnected are queued and replayed on reconnect | 05§E2 | Upgrade F13 AC (F05 EC-006 claims it) | native (Liveblocks) | P1 | S | Add an explicit e2e so it is proven, not assumed |

### P2 — valuable

| ID | Capability | One-line behaviour | Evidence | Mapping | RF fit | Pri | Eff | Notes / risks |
|---|---|---|---|---|---|---|---|---|
| R-020 | Group / ungroup | Ctrl+G / Ctrl+Shift+G; click selects whole group; Ctrl+click enters group; move together | 02§F-G01,G02,G03; 01§S6; 03§F-26 | **New F23** | custom logic (tag model) | P2 | M | One level only; double-click stays label edit (Q7) |
| R-021 | Lock / unlock | Ctrl+Shift+L; locked nodes not selectable/draggable; context menu can unlock; "Unlock all" | 02§F-G04; 03§F-26 | **New F23** | native per-node `draggable`/`selectable` | P2 | S | `data.locked`; viewers unaffected |
| R-022 | Z-order commands | Ctrl+[ / ] backward/forward; Ctrl+Shift+[ / ] back/front; context-menu items | 02§F-G05,F-Z01; 03§F-25; 05§C3; 04§D2 | **New F23** | custom (C2) | P2 | M | Blocked on Q4–Q5 |
| R-023 | Frames / sections | Labelled container ("VPC", "Region"); children move with it; optional clipping; F key | 01§S5,T9; 02§F-G06 | **New F23** | native sub-flow (`parentId`, `extent`) | P2 | M | Coordinates become relative to parent — persistence and F17 output must handle it |
| R-024 | Multi-node resize | Union bounding box with handles; resizing scales all selected; one undo entry | 01§S7 | Upgrade F08 | custom logic | P2 | M | Emits many changes → one Liveblocks batch |
| R-025 | Edge style options | Per edge: kind (smoothstep/bezier/straight/step), stroke solid/dashed/dotted, width 1/2/3 | 02§F-A01,A02; 03§F-32,F-33,F-34 | Upgrade F09 | native (built-in paths, `strokeDasharray`) | P2 | S | Schema v2 `edge.data.style`; edge toolbar UI |
| R-026 | Edge markers start/end | none / arrow / triangle / diamond / circle / bar / crow's-foot (one, many) at either end | 02§F-A03; 03§F-35 | Upgrade F09 | native `markerStart/End` + custom `<defs>` | P2 | S | Keep ≤ 8 kinds; defs per colour |
| R-027 | Node text options | Font size S/M/L (Ctrl+Shift+< >), H-align, V-align per node | 01§X6,X7,X9; 03§F-36 | Upgrade F08 (shared with F22) | custom node data + CSS | P2 | S | Schema v2 `data.text`; keep centred default |
| R-028 | Node border style / width | solid/dashed/dotted, 1/2/3 px | 03§F-32,F-33 | Upgrade F08 | CSS | P2 | S | Schema v2 `data.border` |
| R-029 | Properties panel | Floating panel shows only controls the selection supports (predicate per type); hosts colour, text, border, align, layer, actions | 03§F-31,F-38,F-39,F-52 | Upgrade F08 (new component) | app UI | P2 | M | Numeric x/y/w/h inspector folded in (P3) |
| R-030 | Copy / paste styles | Ctrl+Alt+C / V copies colour, text and border options to other nodes | 03§F-30 | Upgrade F08/F10 | app logic | P2 | S | One batched write |
| R-031 | Colour picker: hex + recent | "More colours" popover with hex input, 5 recent; text colour auto-picked for ≥ 4.5:1 | 03§F-41,F-44 | Upgrade F08 | app UI | P2 | S | Needs Q12; `data.color` becomes id-or-hex |
| R-032 | Object snapping with guides | Alt+S toggles snapping to other nodes' edges/centres (8 px); Ctrl inverts per gesture; helper lines | 02§F-S01,S02,S04; 03§F-53 | Upgrade F10 (own task group) | custom (`onNodeDrag` + overlay) | P2 | M | N×N cost: throttle, limit to visible nodes; gap snapping later |
| R-033 | Node search | Ctrl+F finds nodes by label; Enter fits view to match | 03§F-27 | Upgrade F10 | app UI | P2 | S | `preventDefault` only when canvas focused |
| R-034 | Context menu upgrade | Per-item predicates (viewer hides mutators), collapsed separators, `<kbd>` hints; adds Paste, Copy, Cut, Lock, Group, Z-order, Align, Copy as PNG as they ship | 03§F-28,F-29 | Upgrade F10 | app UI | P2 | S | Keep node menu short |
| R-035 | Connection-target highlight | While dragging a connection, hovered target node highlights (not only its handle) | 02§F-A07 | Upgrade F09 | native `useConnection` + CSS | P2 | S | Visual only |
| R-036 | Alt+drag duplicates | Holding Alt at drag start clones selection and drags the clone; one undo entry | 02§F-C04; 03§F-10 | Upgrade F10 | custom logic | P2 | S | Alt+drag collides with some Linux WMs; document |
| R-037 | Images on canvas | Insert via picker / paste / drop; placeholder then Blob URL; 1440 px max side, 4 MB; PNG/JPEG/WebP (+ sanitised SVG later); crop skipped | 02§F-I01–I06; 04§H1–H3; 05§C5; 01§T7 | **New F24** | custom node + server route + Blob | P2 | L | Server enforces limits and auth by project role; orphan sweep in F13 |
| R-038 | Insert-mode import | Dropping a `.json` on the canvas inserts (re-id, offset) instead of replacing; "Add to canvas" button in import dialog | 04§F1; F19 "merge" option | **F19 fill** | app UI | P2 | S | Reuses C3 helper; Q8 |
| R-039 | Blank canvas with confirmation | "New blank canvas" in the templates dialog; one batch, one undo, hard delete, `CANVAS_REPLACED` broadcast | 04§A1; 03§F-13 | Upgrade F14 | collaboration | P2 | S | Confirmation names other editors |
| R-040 | Remote selection + editing badge | Presence `selectedNodeIds` and `editingNodeId`; coloured outline and "X is editing" | 05§B4,D1 | Upgrade F11 (+ F08 hook) | presence + custom node CSS | P2 | S | Send on change, not per pointer frame |
| R-041 | Presence status + go-to-collaborator | active/away/idle (60 s) dims cursor; click avatar centres on their cursor; search when ≥ 8 | 05§B2,B3 | Upgrade F11 | presence + viewport API | P2 | S | Throttle idle writes |
| R-042 | Cursor polish | Button-down ring; colour hashed from user id, not connection | 05§B1 | Upgrade F11 | presence | P2 | S | — |
| R-043 | Element library / snippets | Save selection as a named snippet; sidebar to insert at pointer; `.json` library file with version | 02§F-L01–L03; 04§J1 | **New F25** | app UI + C3 helper | P2 | M | Per-user storage (Postgres row or Blob) decided in spec; validate with canvas Zod |
| R-044 | Freehand strokes | Pen tool; stroke-as-node; as drafted in F21 | F21 draft; 01§T11 (autoshape skipped) | **F21 fill** | custom node + `ViewportPortal` | P2 | M | Fold its schema change into v2 (C1) |
| R-045 | Reduced motion | fit/zoom use duration 0 under `prefers-reduced-motion` | 03§F-60 | Upgrade F10 | native | P2 | S | Trivial, above Excalidraw baseline |
| R-046 | Save-pause mechanism named | F13 G-5 "snapshot never overwrites live collaboration" names a pause flag checked before the debounced write, released on disconnect | 04§I2 | Upgrade F13 AC | collaboration | P2 | S | Doc + test only |

### P3 — later

| ID | Capability | One-line behaviour | Evidence | Mapping | RF fit | Pri | Eff | Notes / risks |
|---|---|---|---|---|---|---|---|---|
| R-047 | Sticky palette tool (Q) | Tool stays armed after each insertion; press again or Esc to release | 01§T2; 03§F-21,F-47 | Upgrade F07 | app UI | P3 | S | Must not swallow Esc/Delete |
| R-048 | Alt resizes from centre | Symmetric resize | 01§T5 | Upgrade F08 | custom logic | P3 | S | — |
| R-049 | Lasso selection | Freeform path selects enclosed/crossed nodes | 01§S3 | Upgrade F10 (new tool) | custom overlay | P3 | M | Conflicts with pan/box-select modes |
| R-050 | Box-select "contain" mode | Preference to require full enclosure | 01§S2 | Upgrade F10 | native `selectionMode` | P3 | S | Q3 — recommend not adding |
| R-051 | Node hyperlink | Ctrl+K sets `data.href`; link icon on node | 03§F-26,F-39 | Upgrade F08 | app UI | P3 | S | Schema v2 reserves `href` |
| R-052 | Edge waypoints / elbow segments | User-dragged midpoints; fixed segments survive node moves | 02§F-A04,A05 | Upgrade F09 (later) | custom edge | P3 | L | High defect risk; four-handle model stays |
| R-053 | Scroll-back-to-content | Button appears when all nodes are off-screen | 03§F-51 | Upgrade F10 | app UI | P3 | S | — |
| R-054 | Sketchy / hand-drawn style | Per-document "sketchy" toggle rendering shapes with rough.js | 03§F-37; owner decision | Upgrade F07 render (later) | custom node render | P3 | M | No architecture change now; dependency later |
| R-055 | Touch handle sizes | Larger hit areas for pen/touch | 01§S8 | Upgrade F08 | CSS | P3 | S | Desktop-first product |
| R-056 | Embedded scene in PNG/SVG | PNG `tEXt` / SVG metadata carries the document for round-trip | 04§E5 | F19 option | custom | P3 | S | Leaks all node text in shared images; default off |
| R-057 | Last-used style for new nodes | New nodes take the last chosen colour/text/border | 03§F-40 | Upgrade F07 | app state | P3 | S | Per-user, not synced |
| R-058 | Follow mode | Follow a collaborator's viewport (`fitBounds` contain); own pan unfollows; no cross-follow | 05§B6 | Upgrade F11 | presence + viewport API | P3 | M | Owner's tool is mostly single-user |
| R-059 | Mermaid import | Paste or dialog converts `flowchart`/`graph` text into nodes+edges with layout | 04§G1 | F19 optional group | custom conversion | P3 | M | Dependency + bundle; Q10 |
| R-060 | Snapshot-style read-only share | Frozen Blob copy behind a token instead of a live public room | 05§A4 | F20 note | server | P3 | — | Record as F20 option A |
| R-061 | Cheat-sheet groups | Three captioned sections instead of one table | 03§F-19 | Upgrade F10 | app UI | P3 | S | Keep AC-019 copy test |
| R-062 | Picker hotkeys / eyedropper | Letter hotkeys inside picker; eyedropper | 03§F-42,F-43 | Upgrade F08 | app UI | P3 | S | EyeDropper API support UNVERIFIED |
| R-063 | Multi-line edge labels | Free text on edges beyond the pill | 02§F-A10 | Upgrade F09 | native `EdgeLabelRenderer` | P3 | S | Pill is fine today |

### P4 — skip (no action; reasons recorded)

| ID | Capability | Reason | Evidence |
|---|---|---|---|
| R-064 | Rotation and flip | Unrotated labelled nodes; edge routing and schema impact | 01§R1,R2 |
| R-065 | Eraser, bucket fill, autoshape, laser, embeddable, hand tool | Not node-diagram tools; React Flow pans natively; laser adds presence state for no gain | 01§T7,T8,T11; 03§F-46,F-47; 05§B5 |
| R-066 | Font family picker, Tab indent, line-height, wrap toggle | Geist only; labels wrap already | 01§X4,X5,X8,X11 |
| R-067 | Zen mode, view-mode toggle, theme toggle, command palette, plain paste, pen mode, phone editor | Chrome already minimal; dark-only; viewer role is view mode | 03§F-12,F-27,F-54,F-56,F-57,F-58 |
| R-068 | E2EE, bearer room links, Excalidraw+ features, public library site / URL import | Breaks server-side authz and AI; paid/hosted; separate product | 05§A1,A2,G3; 02§F-L04,L05 |
| R-069 | Element `version`/`versionNonce`, tombstones / soft delete, localStorage draft, cross-tab stamp | Liveblocks resolves conflicts; owner chose hard delete; a browser draft is a second authoritative copy | 04§D1,I1,I3; 05§C4,D3 |
| R-070 | Free arrow binding, binding toggle, image crop | Four-handle model stays; crop is a second edit mode | 02§F-A06,A09,I05 |
| R-071 | Text-to-diagram AI dialog | Covered by F17 behind the gateway adapter | 04§G2 |
| R-072 | Clerk Pro branding toggle | Unnecessary once flows are custom (F27) | LA§F-7,F-8 |
| R-073 | Click-vs-drag creation, min-size rules, hit tolerances, handle visuals | drawArc already does these natively or intentionally differently | 01§S1,S9,T3,R3,R5 |

Counts: P1 19 · P2 27 · P3 17 · P4 10 (73 rows; each P4 row bundles several findings).

## 4. Proposed new feature packages

| # | Name | Purpose | Absorbs | Depends on | Size |
|---|---|---|---|---|---|
| **F22** | text-and-sticky-notes | Two new node kinds for whiteboarding: borderless auto-width/fixed-width text, and a filled sticky note; both use the F08 label editor and the shared `data.text` options. Keyboard T/N, palette entries, Zod union, F14/F17 validators updated. | R-005, R-006, R-027 (shared) | Schema v2 (C1), registry (C6) | M |
| **F23** | grouping-locking-and-z-order | Structure for larger diagrams: one-level groups (tag model), lock flag, z-order via fractional index with derived `zIndex`, and frames as React Flow sub-flows with a title and optional clipping. | R-020–R-023 | Schema v2, C2 decision, `fractional-indexing` approval | L |
| **F24** | images-on-canvas | Image node backed by Vercel Blob: insert by picker/paste/drop, placeholder → saved, server-enforced size/type limits, role-checked read route, orphan sweep. | R-037 (+ F13 sweep) | Schema v2, Blob, F13 | L |
| **F25** | element-library | Save a selection as a reusable snippet and insert it later; per-user library with versioned JSON file export/import. Confirmed as its own package: F14 templates replace the whole canvas, this inserts fragments. | R-043 | C3 helper (R-001), F19 envelope | M |
| **F26** | landing-page | Static marketing page at `/` with metadata/OG/sitemap/robots; header shows Sign in / Open editor via client-side `useAuth`; supersedes F02 FR-005. | R-015 | F01 shell; decision C7 | M |
| **F27** | custom-auth-ui | Zero-branding sign-in, sign-up, forgot-password, device-trust and user menu built on Clerk custom flows; server gate and `proxy.ts` unchanged; OAuth optional. | R-016, R-017 | F02; decision C7; Clerk dashboard config for OAuth (owner) | L |

Confirmed/rejected candidates: **F26 and F27 kept separate** (recommended, Q13): different risk profiles (static page vs auth state machine with E2E), can run in parallel worktrees, landing can ship even if auth slips; they share one decision-log entry for the F02 overrides. **Mermaid stays inside F19** as an optional P3 requirement group (same import dialog, same insert path) rather than a new package. **F19 and F21 are filled in**, not re-created (R-013, R-014, R-038, R-044). **Object snapping stays an F10 task group**, not a package. **Follow mode is an F11 upgrade** (P3). No package for "properties panel": it is the F08 upgrade's UI home.

Schema v2 itself is not a package: it is the first task of whichever batch-1 feature lands first (recommended: F22), with the field list from C1 reserved for F21/F23/F24.

## 5. Proposed implementation batches

Each batch = 2–4 features in parallel worktrees (M1 round pattern, D-044). Order within a batch is free; batch order matters.

| Batch | Features (parallel) | Why this order | Prerequisite / sequencing |
|---|---|---|---|
| **1 — daily feel** | (a) **F10 upgrade** R-001–R-004, R-009–R-012, R-034, R-045 · (b) **F08 upgrade** R-007, R-008, R-027, R-028, R-030 · (c) **F22** text + sticky · (d) **F26** landing | Cheapest set the owner feels immediately: clipboard, grid, align, shift-resize, auto-grow, text/sticky, landing | Schema v2 migration lands first inside (c) on day 1 and is merged before (b) adds `data.text`/`data.border`; C6 registry lands first inside (a). (d) is independent. |
| **2 — structure and I/O** | (a) **F27** custom auth · (b) **F09 upgrade** R-025, R-026, R-035 · (c) **F19** R-013, R-014, R-038 (+ R-039 in F14) · (d) **F23** groups/lock/z-order/frames | Edge styling and export are the next most-used; F27 removes Clerk branding; F23 needs C2 decided | Needs Q4/Q5 (z-order), Q8 (insert import), Q9 (SVG fonts), Q11 (Clerk/OAuth) answered before specs. |
| **3 — media and collaboration polish** | (a) **F24** images · (b) **F11 upgrade** R-040–R-042 (+ F08 hook) · (c) **F21** freehand · (d) **F25** library | Lower daily frequency; all depend on batch-1 helpers (clipboard, schema v2) | F24 needs a Blob read-route design; F21 dependency approval. |
| **4 — later (P3)** | F10b object snapping R-032 · F19 Mermaid R-059 · F11 follow R-058 · F07 sketchy R-054 · lasso R-049 | Only after the owner has used batches 1–3 daily | Each needs its own decision (Q10 for Mermaid). |

Verification per batch follows the existing pattern: lint/check/build, lean tests on behaviour (paste re-id + edge remap, migration fixtures v1→v2, align batch = one undo), e2e for auth flows and offline replay.

## 6. Owner decisions required

Each is yes/no or A/B. Recommendation in bold.

1. **Esc in the label editor** — A: keep F08 FR-007 (Esc cancels, Enter commits, Shift+Enter newline) · B: Excalidraw (Esc commits, Ctrl+Enter commits). **A** — already a fixed rule; recording it closes the research flag (01§X2, X3).
2. **Ctrl+D duplicate placement** — A: keep +20/+20 offset (F10 FR-007) · B: in place like Excalidraw. **A** — in-place copies are invisible on a shared canvas (03§F-09).
3. **Box-select mode** — A: keep `partial` only · B: add a "contain" preference. **A** — one mode, less UI (01§S2).
4. **Z-order approach** — A: fractional `data.order` + derived `zIndex` · B: numeric `data.zIndex` · C: no z-order. **A** (C2).
5. **Dependency `fractional-indexing`** — A: approve the package · B: hand-roll a ~40-line midpoint helper. **A** — zero deps, tiny, battle-tested; B acceptable if you prefer no new package.
6. **Schema v2 as one migration** reserving optional fields for F21/F23/F24 now — yes/no. **Yes** (C1).
7. **Group model** — A: groups = `data.groupId` tag (move-together logic, no coordinate change) and frames = React Flow `parentId` sub-flow · B: everything via `parentId`. **A** — a loose group must not re-parent coordinates; frames genuinely are containers. Enter-group gesture: Ctrl+click (double-click stays label edit).
8. **Insert-mode import** ("Add to canvas" and drop-to-insert) in F19 alongside replace — yes/no. **Yes** — reuses the clipboard helper, cheap (04§F1).
9. **SVG export font strategy** — A: PNG only in the first F19 cut; SVG later only if lossless · B: SVG now with `font-family` fallback (no embedding, lossy) · C: embed a Geist subset at export time. **A** — nodes are HTML, so a faithful SVG needs re-rendering; do not block PNG on it (04§E3; F19 candidate 3).
10. **Mermaid import** — A: defer; keep as an optional P3 group in F19 and approve the dependency when scheduled · B: include in batch 2. **A** (04§G1; bundle size and security UNVERIFIED).
11. **Clerk strategy** — A: custom flows on the Free plan (email+password, email code, device trust, forgot password), OAuth (Google/GitHub) as a follow-up task needing dashboard credentials · B: keep prebuilt components and pay for Pro to remove the badge. **A** — B still shows Clerk-hosted "Manage account" (LA§F-6, F-7). Sub-question: include OAuth in F27 v1? **No** — add when wanted; each provider is ~1 day plus dashboard setup.
12. **Node colours** — A: palette ids only (current) · B: palette + arbitrary hex with automatic legible text colour and a recent list. **B** — whiteboarding wants more than 8 colours; a contrast guard keeps F08 NFR-006 (03§F-41).
13. **F26 / F27 packaging** — A: two packages run in parallel (batch 1 and batch 2) · B: one merged package. **A** (§4 reasons).

## 7. Unverified items (consolidated)

- All visuals: handles, selection colours, snap guides, grid, frame labels, export output, dialogs — no screenshots opened; no live app run (`01`–`04`). Only `public/screenshots/collaboration.png` was viewed, and it is a marketing mock (`05` §A3).
- Excalidraw behaviours read only partially: groups click/drag/resize (`01` S6), plain Enter in the text editor (`01` X3), empty-text deletion on blur, lasso/box-select default preference values, image/embeddable tool clicks, autoshape and magic frame, Ctrl+D exact offset and Alt+drag clone semantics (`02` F-C04), vertical distribute key (`02` F-S06), group double-click branch, library drag-to-insert, SVG sanitiser depth, copy-as-SVG library, `applyDarkModeFilter` body, mixed-value rendering in the properties panel, stats panel editability, selection-only undo entries end-to-end, Tab/Ctrl+Shift+V/Ctrl+Enter keyTests, reduced-motion coverage beyond two SCSS files, focus-trap behaviour.
- Hosted/socket behaviour: reconnect semantics, offline-edit loss (`05` E2), tombstone GC resurrection, undo after remote delete, Excalidraw+ pricing, Firebase share links, version history, font-inlining offline fallback, Mermaid offline fallback, TTD AI endpoint.
- React Flow 12.12 specifics not re-checked against docs in this pass: `NodeResizer keepAspectRatio` at runtime, `selectionMode` naming, edge `interactionWidth` default, `getNodesBounds`/`getViewportForBounds`, edge repair on `setEdges`, built-in edge type names, `html-to-image` with React 19 and `next/font` variables, `@liveblocks/react-flow` deep-merge depth for new `data` sub-objects (R-05 in the risk register). Verify with Context7 before each spec.
- Clerk: exact `useSignUp` status set in `@clerk/nextjs ~7.9.20`, `openUserProfile`/`<UserProfile>` branding on Free, branding in Clerk-sent emails, dev-mode banner on custom-flow pages, Account Portal fallback redirects, production custom-domain DNS requirement, Pro price.
- Liveblocks limits for large documents and reconnect queue depth (`05` C6, E2): check docs before the F13 AC and the F24 spec.
- Browser clipboard support matrix (write/read text, PNG) and EyeDropper API for the owner's browsers.
