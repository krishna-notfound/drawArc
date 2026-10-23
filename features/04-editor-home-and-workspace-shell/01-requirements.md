# F04 — Requirements

## Functional requirements

| ID | Requirement (shall-statement, testable) | Priority | Source | Acceptance criteria |
|---|---|---|---|---|
| FR-001 | `/editor` shall be a Server Component that renders the navbar, the empty-state prompt (heading "Create a project or open an existing one", description "Start a new architecture workspace, or choose a project from the sidebar.", button "New Project" with `Plus` icon), and the project sidebar whose lists are loaded in a `<Suspense>` child via `requireUser()` → `listMyProjects(user.id)` / `listSharedProjects(user.id)`. | must | PRD-004, US-1 | AC-001, AC-002 |
| FR-002 | The project sidebar (F01's `components/editor/project-sidebar.tsx`, extended) shall show tabs "My Projects" and "Shared with me" (with counts), list items as `<Link prefetch={true} href={`/editor/${id}`}>` showing name (truncated, `title` attr) and relative `updatedAt`, highlight the item equal to `currentProjectId`, and show F01's per-tab empty copy ("No projects yet" / "Create your first project to get started." and "Nothing shared with you yet" / "Projects others share with you will appear here."). | must | PRD-004, US-1, F01/FR-012 | AC-003, AC-004 |
| FR-003 | Owned items shall expose a dropdown (`MoreHorizontal` icon, `aria-label="Project actions"`) with "Rename" and "Delete"; shared items shall render no dropdown and no hidden/disabled variant of it. | must | PRD-003, US-3, US-4 | AC-005 |
| FR-004 | Create dialog: title "Create project", one `Input` labelled "Project name" (placeholder "Untitled Project", `maxLength=100`, autofocus), buttons "Cancel"/"Create"; **no slug field or preview** (O-3). Submit calls `createProject({ name })`; on success closes and `router.push(`/editor/${id}`)`. | must | PRD-003, US-2 | AC-006, AC-007 |
| FR-005 | Rename dialog: title "Rename project", description `Renaming "{current name}".`, input prefilled with the current name, text selected and focused on open, Enter submits, buttons "Cancel"/"Save"; calls `renameProject({ projectId, name })`. | must | PRD-003, US-3 | AC-008 |
| FR-006 | Delete dialog: title "Delete project?", description `"{name}" and its canvas, members, and room will be permanently deleted. This can't be undone.`, no input, buttons "Cancel" / "Delete project" (destructive variant); calls `deleteProject({ projectId })`; if the deleted id equals the current workspace id, navigates to `/editor`. | must | PRD-003, US-3 | AC-009, AC-010 |
| FR-007 | `useProjectDialogs()` shall own `{ dialog: null \| { kind: 'create' } \| { kind: 'rename' \| 'delete', project }, name, pending, error }`, expose `openCreate/openRename/openDelete/close/setName/submit`, run actions inside `startTransition`, disable submit while `pending`, reset `name`/`error` on open, and map `ActionResult` errors to `fieldErrors.name` (inline) or a banner. | must | D-027 | AC-011, AC-012 |
| FR-008 | After a successful create/rename/delete, the sidebar lists shall reflect the change in the same action response (F03 `updateTag`) without a manual refresh. | must | PRD-004, F03/FR-012 | AC-013 |
| FR-009 | `/editor/[projectId]` shall be a Server Component typed `PageProps<'/editor/[projectId]'>` that passes `params` into a `<Suspense>` child; the child awaits `params`, calls `requireProjectRole(projectId, 'viewer')`, then calls the F13-owned seed hook `seedRoomIfEmpty(project)` (D-034; F04 ships it as a no-op stub returning `{ seeded: false, snapshotExists: project.canvasBlobPath !== null, warning: null }`), and renders `Workspace` on success. | must | PRD-005, code-standards rule 1, D-034 | AC-014, AC-015 |
| FR-010 | Unauthenticated visitors shall be redirected to sign-in with a return URL to the requested project; after sign-in they land on the workspace. | must | PRD-001, PRD-005, US-5 | AC-016 |
| FR-011 | For a malformed id, a non-existent project, or a signed-in non-member, the gate shall render `AccessDenied` with byte-identical HTML and HTTP 200 in all three cases; `AccessError` is the only error caught — redirects and unexpected errors propagate. | must | PRD-005, PRD-014, US-6 | AC-017, AC-018 |
| FR-012 | `AccessDenied` shall render centred: `Lock` icon (`h-8 w-8`), heading "You can't open this project", text "It may not exist, or you haven't been invited. Ask the owner to share it with you.", link "Back to projects" → `/editor`. | must | PRD-005 | AC-019 |
| FR-013 | `Workspace` shall render: navbar (sidebar toggle · project name · "Archived" badge when status is `ARCHIVED` · slots `saveStatusSlot`, `importSlot`, `shareSlot`, AI toggle); presence corner top-right rendering `presenceSlot ?? <UserMenu/>` (F11 supplies `PresenceStack`, which contains the `UserButton`, so the default is replaced, never duplicated); a flush full-viewport canvas area (`canvas` slot; placeholder "Your canvas will appear here." on a dot background); right AI sidebar (F01's `AiSidebar`; toggle works; F01's default body "The AI design agent arrives in a later release."); the floating project sidebar with `currentProjectId`. | must | PRD-020 (chrome), ui-context layout, F01/FR-013 | AC-020, AC-021 |
| FR-014 | The canvas slot's client island shall receive exactly `{ projectId: string; role: ProjectRole; currentUser: { id: string; name: string \| null; avatarUrl: string \| null } }`; when the project is `ARCHIVED`, `role` passed to the island shall be `'viewer'`. | must | F06 contract, security-model rule 5 | AC-022 |
| FR-015 | `app/editor/[projectId]/error.tsx` (`'use client'`) shall render "Something went wrong loading this project.", "Reference: {digest}" when `error.digest` exists (as F00's `app/error.tsx` does), a "Try again" button calling `retry()`, and "Back to projects"; it shall not call `console.*` (F00 lint rule; the server already logged the error with its digest). | must | PRD-041, F00/FR-008 | AC-023 |
| FR-016 | Sidebar and dialogs shall be keyboard-operable: dialogs trap focus, close on Esc, restore focus to the opener; dropdown opens with Enter/Space and arrows; every icon-only button has `aria-label` and a tooltip; no axe violations of impact `serious`/`critical`. | must | NFR-006 | AC-024, AC-025 |
| FR-017 | Below 768 px the sidebar overlays with a backdrop scrim; tapping the scrim or navigating closes it; closed sidebars are fully off-screen (`translateX(-100%)` / `100%`). | should | ui-context "Sidebars", US-7 | AC-026 |
| FR-018 | No component under `app/editor/**` or `components/editor/**` shall call `useParams`, `useSearchParams`, or `usePathname`; the current project id is passed as a prop from the server page. | should | code-standards rule 4 | AC-027 |

## Non-functional requirements exercised

| NFR | How this feature meets it |
|---|---|
| NFR-001 | The only access decision is `requireProjectRole` in the server gate; client receives role for affordances only (data-ownership rule 4). |
| NFR-003 | Workspace shell streams: static shell (navbar frame, skeleton) prerendered, gate resolves in Suspense; measured in TC-015 with `instant()`. |
| NFR-006 | FR-016, FR-017; axe smoke in TC-024/TC-025. |
| NFR-007 | `PageProps` helper types; `ProjectRole` union; `ActionResult` narrowing in the hook. |

## UX and interaction behaviour

| State / input | Behaviour |
|---|---|
| Sidebar toggle (F01 navbar: `PanelLeftOpen`/`PanelLeftClose`, `aria-label` "Open projects sidebar" / "Close projects sidebar", `aria-expanded`, `aria-controls="project-sidebar"`) | opens/closes; state is client-only (F01 `EditorShell` / `useEditorChrome()`, extended here with `setSidebarOpen`/`setAiOpen`), default open ≥ 1024 px, closed below (overrides F01 D-F01-4 as F01 allowed). |
| Tabs | shadcn `Tabs`; default "My Projects"; counts in a `Badge`. |
| Item click | client navigation; sidebar closes on < 1024 px. |
| Dropdown "Rename" | opens Rename dialog with that project. "Delete" opens Delete dialog. |
| Create submit with empty name | allowed — server defaults to "Untitled Project" (F03/FR-008). |
| Pending | submit button shows spinner + "Creating…" / "Saving…" / "Deleting…", all inputs and Cancel disabled; dialog cannot be closed by Esc/overlay while pending. |
| Action error | `VALIDATION` with `fieldErrors.name` → text under the input (`aria-describedby`); any other → banner at the top of the dialog with the server `message`; dialog stays open; focus moves to the banner. |
| `NOT_FOUND` on rename/delete | banner "That project no longer exists." and lists refresh (project vanishes). |
| Workspace navbar project name | from server props; updates after rename in the same response. |
| AI toggle (`Sparkles` icon, `aria-label="Toggle AI sidebar"`) | opens right sidebar placeholder; closed by default. |
| Reduced motion | sidebar transitions disabled under `prefers-reduced-motion`. |

Copy and tokens: `context/ui-context.md`. Radius: dialogs `rounded-3xl`, sidebar panels `rounded-2xl`.

## Error handling and edge cases

| ID | Condition | Expected behaviour | Covered by |
|---|---|---|---|
| EC-001 | Unauthenticated `GET /editor/{id}` | redirect to sign-in with `redirect_url=/editor/{id}` | AC-016 |
| EC-002 | Malformed id / missing project / non-member | identical AccessDenied, 200 | AC-017, AC-018 |
| EC-003 | Archived project opened by URL by a member or owner | workspace renders with "Archived" badge, island role `viewer`; owner still sees Delete in the sidebar? No — archived projects are not listed; owner acts via a later archive UI | AC-021, AC-022 |
| EC-004 | Project deleted in another tab, then Rename submitted here | `NOT_FOUND` banner; list refreshes; if it was the current workspace, next navigation shows AccessDenied | AC-012 |
| EC-005 | Rename to the identical name | action succeeds (no-op); dialog closes | AC-008 |
| EC-006 | Double-click "Create" | second click ignored: button disabled while pending; exactly one project | AC-011 |
| EC-007 | Action throws "Failed to find Server Action" after a deploy | hook catches the rejected promise → banner "The app was updated. Please reload and try again." | AC-012 |
| EC-008 | `UPSTREAM` from action | banner with server message; retry allowed | AC-012 |
| EC-009 | Deleting the currently open project | after success `router.push('/editor')`; sidebar no longer lists it | AC-010 |
| EC-010 | Role changed/removed while on the page (F12 KICK → reload) | page re-renders from the gate with the new role or AccessDenied; no F04 state survives | AC-018 (gate) |
| EC-011 | Lists slow (Neon cold start) | empty-state and navbar visible immediately; sidebar shows skeleton rows | AC-002 |
| EC-012 | 0 owned, N shared | "My Projects" shows empty copy with count 0; "Shared with me" badge N; default tab stays "My Projects" | AC-004 |
| EC-013 | 200-char name from DB (should not occur — schema caps 100) | truncated with ellipsis, full name in `title` | AC-003 |
| EC-014 | Unexpected throw in the gate (DB down) | `error.tsx` renders with retry; redirect errors are not caught | AC-023 |
| EC-015 | Prefetched link to a project whose access was since revoked | navigation re-runs the gate → AccessDenied (prefetch never bypasses the gate) | AC-018 |
| EC-016 | Mobile: sidebar open, user taps a project | navigation + sidebar closes; scrim removed | AC-026 |
| EC-017 | User presses Enter in the Create input while pending | ignored (form `onSubmit` returns early when pending) | AC-011 |
| EC-018 | Owner opens Rename, project renamed elsewhere meanwhile | dialog shows the stale prefilled name; submit overwrites (last write wins); acceptable in M1, documented | — |
