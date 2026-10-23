# drawArc — Glossary

Canonical terms. Specs, code identifiers, and UI copy use these words and no synonyms.

| Term | Definition | Not to be confused with |
|---|---|---|
| **drawArc** | The product. Formerly "Ghost AI" (reference material and repo name only). | — |
| **Owner** (project) | The user whose id is `Project.ownerId`. Has every capability. Never a `ProjectMember` row. | "Owner" (the human who directs this project) — use "project owner" / "the owner (human)" when ambiguous. |
| **Member** | A `ProjectMember` row: an email invited to a project with a role. May or may not be bound to a `User` yet. | Collaborator (reference term; do not use) |
| **Role** | `owner` \| `editor` \| `viewer`, computed by `getProjectRole`. | Clerk roles/orgs (unused) |
| **Editor** | Member who may mutate the canvas, save snapshots, and start AI/spec runs. | The editor UI ("workspace") |
| **Viewer** | Member with read-only room access; sees presence and cursors. | — |
| **Project** | The unit of ownership, sharing, and canvas state. One Liveblocks room per project. | Document (do not use), Workspace (not an entity) |
| **Workspace** | The `/editor/[projectId]` screen (canvas + chrome). A UI term only. | A tenancy entity (explicitly not in scope) |
| **Editor home** | The `/editor` screen listing projects. | — |
| **Room** | The Liveblocks room whose id equals `projectId`. | — |
| **Canvas** | The React Flow surface and its contents (nodes + edges). | Room (transport), Snapshot (durable copy) |
| **Node** | A diagram element with `shape`, `label`, `color`, position and size. | Shape (one attribute of a node) |
| **Shape** | One of six visual forms a node can take: rectangle, diamond, circle, pill, cylinder, hexagon. | Node |
| **Edge** | A directed connection between two node handles, optionally labelled. | Connector / arrow (do not use) |
| **Handle** | One of four connection points on a node: `top`, `right`, `bottom`, `left`. | — |
| **Palette** (shape) | The bottom-centre pill from which shapes are dragged onto the canvas. | Colour palette (the 8 node colour pairs) |
| **Colour pair** | A `{ fill, text }` combination identified by `NodeColorId`. | — |
| **Canvas document** | `{ schemaVersion, nodes, edges }` — the serialised, runtime-field-free form of a canvas. | Snapshot (the stored instance of a canvas document) |
| **Snapshot** | The canvas document persisted to Blob at `canvas/{projectId}.json`, referenced from `Project`. | Liveblocks version-history snapshot (`createVersionHistorySnapshot`) — say "version snapshot" |
| **Autosave** | Client-driven, debounced upload of the canvas document by an owner/editor. | Liveblocks persistence (automatic, server-side) |
| **Seed** | Loading a snapshot into an empty room. | Import (templates) |
| **Template** (starter) | A code-defined canvas document a user can import to **replace** the current canvas. | Snapshot |
| **Presence** | Ephemeral per-connection state: cursor, `thinking`. | Storage |
| **Storage** | Liveblocks' persisted, conflict-resolved document (`flow` key) that `useLiveblocksFlow` manages. | Postgres, Blob |
| **History** | Liveblocks per-client undo/redo stack. | Version history |
| **KICK** | Room event broadcast after a member is removed; the client logs out of Liveblocks and reloads. | **ROLE_CHANGED** — broadcast on a role change; same client behaviour, after which the auth route issues the new token |
| **Run** | A Trigger.dev execution of the design agent or spec generator; tracked by `TaskRun`. | Job (do not use), Task (the code definition of a run) |
| **Design agent** | The M2 background task that turns a prompt into room mutations. | AI sidebar (the UI) |
| **Spec** | A Markdown technical specification generated from a canvas (M3), stored in Blob, listed via `ProjectSpec`. | Feature spec (our planning documents) |
| **Feature spec / package** | A `features/NN-name/` folder of planning documents. | Spec (M3 artifact) |
| **Gate** | One of the seven human-approval checkpoints in `ai-workflow-rules.md`. | — |
| **Milestone** | M1 / M2 / M3 delivery stages (`project-overview.md`). | Gate |
| **Quality gate** | `npm run check` (+ build/E2E where required). | Gate (approval) |
| **APPROVED / PROPOSED / OPEN / VERIFIED / UNVERIFIED** | Status vocabulary defined in `context/README.md`. | — |
