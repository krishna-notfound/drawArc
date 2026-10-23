# drawArc — Project Overview

> Status: **APPROVED** product identity and milestone plan (owner, 2026-10-22). Details marked PROPOSED are open.

## What drawArc is

drawArc is a real-time collaborative system-design canvas. A project owner creates a diagram, invites friends or teammates by email, and everyone edits the same node-and-edge architecture diagram at once with live cursors. An AI design agent can draft or extend the architecture from a plain-English prompt directly into the shared room, and the finished graph can be turned into a Markdown technical specification.

drawArc was previously named **Ghost AI**; the repository (`ghost_ai`) and the reference material keep the old name. The product, routes, copy, and documentation use **drawArc**.

## Who it is for

- **Primary:** developers and small teams sketching system architectures together — pairing on a design, reviewing a proposal, teaching a pattern.
- **Secondary:** a solo developer who wants an AI starting point for an architecture and a spec to hand to collaborators.
- **Not for:** general whiteboarding, slide-making, enterprise diagram governance. Excalidraw and tldraw serve free-form drawing better; drawArc is deliberately a *node-and-edge* editor (see [decision-log.md](decision-log.md) D-008).

## Core user flow

1. User signs in (Clerk).
2. User creates a project or opens one from "My Projects" / "Shared with me".
3. The workspace opens: full-viewport canvas, floating project sidebar on the left, AI sidebar on the right.
4. User drags shapes from the bottom palette, labels them, resizes, recolours, and connects them with labelled edges.
5. Collaborators join the same project and see each other's cursors and edits immediately.
6. The canvas autosaves; reopening the project later restores the diagram.
7. *(M2)* A user prompts the AI agent; it adds and arranges nodes in the live room while everyone watches.
8. *(M3)* A user generates a Markdown spec from the current graph, previews it, and downloads it.

## Milestones

| Milestone | Scope | Exit criterion |
|---|---|---|
| **M1 — Collaborative editor** (features `00`–`15`) | Auth, projects, sharing, canvas editing, real-time collaboration, persistence, templates, deployment | The **M1 acceptance run** passes on a deployed environment (below) |
| **M2 — AI design agent** (features `16`–`17`) | AI sidebar, room chat, status feed, Trigger.dev agent writing into the room | A prompt produces a valid diagram in the shared room, visible to all participants, with status and presence |
| **M3 — Spec generation** (feature `18`) | Graph → Markdown spec, persistence, preview, download | A spec is generated from a real diagram, stored, listed, and downloadable only by project members |
| Future (`19`–`21`) | Import/export, public share links, freehand strokes | Deferred; `00-overview.md` only |

M2 does not start until M1's exit criterion is demonstrated and the owner approves. The canvas schema is frozen at the end of feature `06` and versioned thereafter (see [domain-model.md](domain-model.md)).

### M1 acceptance run (the definition of "done" for the MVP)

Two signed-in users, A (owner) and B (invited editor), in separate browsers against the deployed app:

1. A creates a project; B cannot open it (access denied).
2. A invites B by email with role *editor*; B opens the project.
3. Both add, move, resize, recolour, label, and connect nodes; each sees the other's changes within a second and sees the other's cursor.
4. A undoes their own last change; B's changes are unaffected.
5. B reloads the page and sees the identical diagram; A closes the tab, reopens the project an hour later, and sees the identical diagram (snapshot restore).
6. A changes B to *viewer*; B can no longer modify the canvas. A removes B; B is ejected from the room within 5 seconds and cannot rejoin.
7. A imports a starter template, which replaces the canvas for both users (before step 6).
8. All of the above with no console errors, and the quality gate (`npm run check`) green on the deployed commit.

## Product principles

1. Correctness and usability before feature quantity.
2. Real-time collaboration is part of the initial architecture, not an add-on.
3. Every data category has exactly one authoritative source ([data-ownership.md](data-ownership.md)).
4. Authorization is enforced on the server at every mutation and every room join ([security-model.md](security-model.md)).
5. Every feature has measurable acceptance criteria with a named verification method.
6. Specifications are approved before implementation; approval of one feature authorizes only that feature.
7. Architectural changes are explicit, logged, and reviewable ([decision-log.md](decision-log.md)).
8. No speculative abstractions or unjustified infrastructure.
9. A feature is complete when its acceptance criteria are verified, not when it compiles.
10. The owner retains final approval authority.

## Success metrics (PROPOSED)

- **M1:** acceptance run passes; p95 time from local edit to remote render < 500 ms on a normal connection (measured in the two-browser E2E test); zero data-loss reports across 20 reload cycles in the E2E suite.
- **M2:** ≥ 90 % of agent runs on the five canonical prompts (see feature `17`) produce a diagram with valid shapes/colours and no overlapping nodes; failures are reported to the room, never silent.
- **M3:** a spec is generated for every canonical diagram within 60 s and the download is gated by project membership (authorization test).

## Explicit non-goals

Workspaces/teams, billing, enterprise roles, public/anonymous links (reserved for the future), freehand drawing (roadmap), mobile-native apps, version-history UI, offline editing beyond Liveblocks' reconnect queue, more than 10 simultaneous participants per project (Liveblocks Free/Pro room limit — a product constraint), rotation of shapes, rich text inside nodes.

See [product-requirements.md](product-requirements.md) for the requirement-level statement of scope.
