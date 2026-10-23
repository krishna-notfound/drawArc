# drawArc — Product Requirements

> Status: scope and milestone assignment **APPROVED** (owner, 2026-10-22). Individual requirement wording is **PROPOSED** until the feature spec that implements it is approved. Feature specs refine these into `FR-*`/`AC-*`; this file does not duplicate them.

Each product requirement (`PRD-###`) names the feature package that owns it. Non-functional requirements (`NFR-###`) are cross-cutting and every feature's test plan must show which ones it exercises.

## Milestone 1 — Collaborative editor

### Identity and projects

| ID | Requirement | Owner feature |
|---|---|---|
| PRD-001 | A visitor can sign up and sign in with Clerk; every other route requires a signed-in user. | 02 |
| PRD-002 | A signed-in user has a local `User` record (Clerk id, email, name, avatar) created on first authenticated request and kept current by Clerk webhooks. | 02 |
| PRD-003 | A user can create, rename, and delete projects they own. Deleting a project removes its memberships, snapshot, specs, and Liveblocks room. | 03, 04 |
| PRD-004 | A user sees two lists: projects they own and projects shared with them. | 04 |
| PRD-005 | Opening `/editor/[projectId]` is gated on the server: unauthenticated → sign-in; no membership or missing project → access-denied view. | 04 |

### Sharing and access

| ID | Requirement | Owner feature |
|---|---|---|
| PRD-010 | An owner can invite a collaborator by email with role `editor` or `viewer`, change a role, and remove a collaborator. | 12 |
| PRD-011 | An invitee who has no account yet gains access automatically when they sign up with the invited email. | 02, 12 |
| PRD-012 | Viewers can see the live canvas, presence, and cursors but cannot change anything; the UI hides mutation affordances and the server rejects mutations. | 05, 12 |
| PRD-013 | Removing a collaborator or downgrading to viewer takes effect in the open room within 5 seconds. | 05, 12 |
| PRD-014 | Project links are private: anyone without membership gets access-denied even with the URL. Public links are a future feature (`20`). | 04, 20 |

### Canvas editing

| ID | Requirement | Owner feature |
|---|---|---|
| PRD-020 | The canvas is a full-viewport, pannable, zoomable React Flow surface with a dot background; sidebars float over it. | 01, 06 |
| PRD-021 | A user can add nodes of six shapes (rectangle, diamond, circle, pill, cylinder, hexagon) by dragging from a bottom palette; the node lands centred under the cursor at the current zoom. | 07 |
| PRD-022 | A user can select (click, shift-box, ctrl/cmd-click), move, and resize nodes with a minimum size; resizing updates stored dimensions. | 08, 10 |
| PRD-023 | A user can edit a node's label inline (double-click), with Escape/blur to finish; typing never triggers canvas shortcuts or drags. | 08 |
| PRD-024 | A user can set a node's colour from the 8-pair palette via a floating toolbar on the selected node. | 08 |
| PRD-025 | Every node has connection handles on all four sides; a user can connect any handle to any other handle on another node, reconnect an edge end, and delete edges. | 09 |
| PRD-026 | Edges are smooth-step with an arrowhead, highlight on hover/selection, and support an inline label edited by double-click. | 09 |
| PRD-027 | Delete/Backspace removes the selection (never while typing); undo/redo reverts the current user's own changes only; ⌘/Ctrl-Z, ⌘/Ctrl-Shift-Z, ⌘/Ctrl-Y, +/−, fit-view shortcuts work and are documented in the UI. | 10 |
| PRD-028 | A user can replace the canvas with one of at least three starter templates after a confirmation. | 14 |

### Collaboration and persistence

| ID | Requirement | Owner feature |
|---|---|---|
| PRD-030 | Node and edge changes by one participant appear for all others without a refresh. | 05, 06 |
| PRD-031 | Participants see each other's cursors with name badges and an avatar stack of who is present. | 11 |
| PRD-032 | Network loss shows a visible status; edits made offline are sent on reconnect; the user is warned before closing a tab with unsynced changes. | 05 |
| PRD-033 | The canvas is autosaved to durable storage; reopening a project whose room is empty restores the last snapshot. The save status is visible. | 13 |
| PRD-034 | A snapshot records its schema version; loading an older version migrates it forward. | 13 |

### Operations

| ID | Requirement | Owner feature |
|---|---|---|
| PRD-040 | The app is deployed on Vercel with Neon preview branches per PR, and the quality gate runs in CI. | 00, 15 |
| PRD-041 | Server errors are captured with request context; client errors show a recoverable boundary, never a blank screen. | 15 |

## Milestone 2 — AI design agent

| ID | Requirement | Owner feature |
|---|---|---|
| PRD-050 | The AI sidebar offers a prompt box, starter prompts, a room-scoped chat visible to all participants, and a status strip while a run is active. | 16 |
| PRD-051 | Submitting a prompt starts a Trigger.dev run owned by the requesting user and project; the client tracks it with a run-scoped public token. | 17 |
| PRD-052 | The agent writes nodes and edges into the live room through the same collaborative storage the editor uses; its presence (cursor + thinking) is visible; its changes never enter a user's undo stack. | 17 |
| PRD-053 | Generated diagrams obey the canvas schema (allowed shapes, palette, non-overlapping layout); invalid output is rejected and reported, never partially applied silently. | 17 |
| PRD-054 | A version-history snapshot is taken before the agent mutates the room. | 17 |
| PRD-055 | Only editors and owners can start a run; viewers see status only. | 16, 17 |

## Milestone 3 — Spec generation

| ID | Requirement | Owner feature |
|---|---|---|
| PRD-060 | An editor/owner can generate a Markdown spec from the current graph (and chat context); the run is tracked like PRD-051. | 18 |
| PRD-061 | Specs are stored as files with metadata in Postgres; the Specs tab lists them; preview renders Markdown; download is gated by membership. | 18 |

## Non-functional requirements

| ID | Requirement | Verified by |
|---|---|---|
| NFR-001 | **Authorization at the boundary.** Every route handler, server action, Liveblocks auth, and job trigger verifies the caller's project role before acting. No client-supplied `projectId` is trusted without a membership lookup. | Authorization tests per feature |
| NFR-002 | **Input validation.** Every external input (request body, webhook, job payload, snapshot JSON, LLM output) is parsed with Zod before use. | Unit tests on schemas |
| NFR-003 | **Latency.** Local edit → remote render p95 < 500 ms; initial workspace load (auth + room + snapshot) p95 < 3 s on a deployed preview. | Playwright timing in E2E |
| NFR-004 | **Capacity.** A diagram of 500 nodes / 800 edges remains interactive (drag at ≥ 30 fps on a mid-range laptop); room storage stays < 5 MB. | Manual perf check + size assertion |
| NFR-005 | **Durability.** No edit acknowledged by Liveblocks is lost on reload; snapshots are never more than one autosave interval behind the room while a user is active. | E2E reload tests |
| NFR-006 | **Accessibility.** All chrome (dialogs, toolbars, sidebars) is keyboard-operable with visible focus; canvas uses React Flow's built-in a11y; colour pairs meet 4.5:1 contrast. | Playwright a11y checks, manual |
| NFR-007 | **Type safety.** `tsc --noEmit` passes with `strict`; no `any` outside typed boundary adapters. | CI |
| NFR-008 | **Secrets.** No secret reaches the client bundle; env is validated at boot. | Env schema unit test, build check |
| NFR-009 | **Observability.** Every server error and every background run failure is logged with `projectId`, `userId`, and a request/run id. | Log inspection in staging |
| NFR-010 | **Dependencies.** Versions pinned for `@xyflow/react` (12.x), `@liveblocks/*` (one version), `prisma`/`@prisma/*` (7.x); `npm audit --audit-level=high` clean. | CI |

## Out of scope (recorded non-goals)

See [project-overview.md](project-overview.md#explicit-non-goals). Any request that touches a non-goal requires a decision-log entry before specification.
