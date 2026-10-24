# F04 — Editor home and workspace shell

| Field | Value |
|---|---|
| Milestone | M1 |
| Depends on | F03 (project actions, `listMyProjects`/`listSharedProjects`, `requireProjectRole`, `AccessError`), F02 (`requireUser`), F01 (shadcn primitives, tokens, navbar/sidebar shell) |
| Depended on by | F06 (renders its client editor island into the canvas slot), F11 (presence slot), F12 (Share slot + share dialog), F13 (Save-status slot), F14 (Import slot), F16 (AI sidebar body) |
| Product requirements | PRD-004, PRD-005, PRD-014 (plus PRD-003 UI half, NFR-003, NFR-006) |
| Status | see status.md |

## Purpose

F04 is the first demonstrable checkpoint of drawArc (features/README.md): a signed-in user lands on `/editor`, sees their owned and shared projects, creates one through a dialog, and opens `/editor/[projectId]` behind a server-side access gate into a full-viewport workspace whose chrome (navbar, project sidebar, AI sidebar, canvas area, presence corner) is laid out once here and filled by later features. It sits after F03 because every list and mutation it renders comes from F03's data functions and Server Actions, and before F06 because the canvas island needs a gated page and a layout to mount into.

## Problem statement and goals

- Problem: later features each need a place to live (slots) and a guarantee that any component mounted at `/editor/[projectId]` is already authorized and knows `{ projectId, role, currentUser }`. Without one gate and one layout, each feature would re-implement access checks in the client, which security-model.md forbids.
- G-1: `/editor` renders the empty-state prompt and both project lists within one request, with Cache Components validation clean (`npm run build` passes).
- G-2: Create → Rename → Delete work end-to-end through F03 actions with inline errors, keyboard-complete dialogs, and lists that update in the same round trip.
- G-3: `/editor/[projectId]` returns sign-in redirect / AccessDenied / workspace with no existence leak and no `blocking-prerender-*` violation.
- G-4: the workspace layout exposes named slots so F06/F11/F12/F13/F14/F16 add their UI without changing the page or gate.

## Scope

In scope:
- `app/editor/page.tsx` (server) with Suspense-wrapped lists, composed inside F01's `EditorShell`; F01's `components/editor/empty-state.tsx` wired to the Create dialog.
- Project sidebar (F01's `components/editor/project-sidebar.tsx` extended, plus new `project-sidebar-data.tsx`): "My Projects" / "Shared with me" tabs with counts, current project highlight, `<Link prefetch={true}>` items, owner-only dropdown (Rename, Delete), New Project; mobile scrim and off-screen transform come from F01's `SidebarPanel`.
- Dialogs (`components/editor/project-dialogs.tsx`): Create (name only — **no slug**, O-3), Rename (prefilled, autofocus, Enter submits), Delete (destructive confirm, no input).
- `hooks/useProjectDialogs.ts`: dialog/form/pending/error state; calls F03 actions inside `startTransition`.
- `app/editor/[projectId]/page.tsx` gate with `PageProps<'/editor/[projectId]'>`, `params` awaited in a Suspense child, `requireProjectRole(id, 'viewer')`, `AccessDenied` for `AccessError`, and — after access is granted and before rendering — the **snapshot-seed hook point** `seedRoomIfEmpty(project)` owned by F13 (D-034; a no-op stub until F13 lands).
- `components/editor/access-denied.tsx`, `app/editor/[projectId]/error.tsx`, `WorkspaceSkeleton`.
- `components/editor/workspace.tsx` layout: navbar (project name, Save-status / Import / Share / AI-toggle slots), presence slot top-right (defaults to the `UserButton`; F11 replaces it with `PresenceStack`), flush full-viewport canvas slot, right AI sidebar (F01's `components/ai/ai-sidebar.tsx` placeholder body), floating project sidebar.
- Client editor island contract: F06's component receives exactly `{ projectId, role, currentUser }`.

Out of scope / non-goals:
- Canvas, Liveblocks room provider, presence, cursors (F05, F06, F11).
- Share dialog and member list (F12); Save status (F13); Import (F14); AI sidebar content (F16).
- Archive/unarchive UI (F03 provides the actions; no affordance in M1 — see F03 status.md open issue).
- Project search/sort/filter, drag-reorder, favourites (never in M1–M3).
- Slug or vanity URLs (O-3: cuid only).
- Project description editing UI (schema supports it; dialog exposes name only in M1 — PROPOSED, trivial to add later).

## User stories

- US-1: As a signed-in user, I want to see my projects and the ones shared with me so that I can open the right one quickly.
- US-2: As a signed-in user, I want to create a project from the home screen or the sidebar and land directly in its workspace.
- US-3: As a project owner, I want to rename or delete my project from the sidebar, with a confirmation before deletion.
- US-4: As a member of a shared project, I must not see rename/delete affordances for it.
- US-5: As a visitor without a session, when I open a project URL I want to be sent to sign-in and brought back afterwards.
- US-6 (abuse): As a signed-in non-member, when I open `/editor/{anyId}` I must see the same AccessDenied page whether the project exists or not.
- US-7: As a user on a phone, I want the sidebar to overlay the page and close when I tap outside it.

## Key decisions referenced

- D-018 (Server Actions for UI mutations), D-016 (dark theme, tokens), D-034 (server-side snapshot seeding runs inside this gate; F13 owns the function), O-3 (cuid only, no slug — the reference's "live slug preview" is dropped), F03/D-024 (no REST), F03/D-026 (cache tags; this feature verifies invalidation at L3), F02/D-F02-2 (`requireUser` default `'throw'`; `requireProjectRole` therefore throws `AccessError('UNAUTHENTICATED')` and the gate converts it to a sign-in redirect with `returnTo`), F01/D-F01-4 (sidebars closed by default — **overridden here**: the project sidebar defaults open at ≥ 1024 px on the editor home; F01 explicitly left this to F04. On the workspace it is closed by default — D-050).
- **PROPOSED D-027 — `useProjectDialogs` uses `useTransition` + direct action calls, not `useActionState`.** Rationale: one hook drives three dialogs over three actions, each needing reset-on-open, close-on-success, and navigation; `useActionState` binds state to a single action and retains the last result across opens, which forces per-dialog instances and manual clearing. `useTransition` gives a `pending` flag per dialog, keeps the UI interactive, and still honours Next's sequential action dispatch. Submissions still go through `<form onSubmit>` so Enter works and screen readers get a form. Trade-off: no progressive enhancement without JS (acceptable: the editor is JS-only).
- **PROPOSED D-028 — Workspace slot contract.** `Workspace` accepts `ReactNode` slots (`canvas`, `shareSlot`, `importSlot`, `saveStatusSlot`, `presenceSlot`, `aiSidebar`) with placeholders; later features pass real nodes from the server page. Keeps the gate and layout untouched by F06–F16.
- **PROPOSED D-029 — `@axe-core/playwright` as a dev dependency** for the dialog/sidebar a11y smoke (NFR-006). Alternative: manual-only checks. Owner to confirm.

## Reference material

- `context/ui-context.md` (layout patterns, dialogs, copy, accessibility), `context/code-standards.md` (Next 16 rules 1, 4, 5, 8; `PageProps`), `context/security-model.md` (rule 3: identical AccessDenied), `context/architecture-context.md` (Server/client responsibilities, directory layout).
- Research (checked 2026-10-22): `scratchpad/research/nextjs-testing.md` §1 (`params` must be awaited inside Suspense; `blocking-prerender-runtime`; `usePathname`/`useParams` on dynamic routes need Suspense — avoided by passing `currentProjectId` as a prop), §2 (`partialPrefetching`: `<Link prefetch={true}>` for param-dependent authed routes), §6 (actions dispatch sequentially; `useActionState` guidance; action-id rotation error), §7 (`PageProps`, `Pick<PageProps, 'params'>` pattern), §10 (`@next/playwright` `instant()`), §11 (`error.tsx` `{ error, retry }`).
- Reference prompts (intent only): `No_touch_ai/.../04-project-dialogs.md` (dialogs, hook, sidebar actions, mobile scrim — slug dropped), `07-wire-editor-home.md`, `08-editor-workspace-shell.md` (`AccessDenied`, server-side gate, layout). Terminology: reference "collaborator" → "member" (glossary); `roomId` param → `projectId`.
