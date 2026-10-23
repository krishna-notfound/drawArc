# F04 — Design

## Architecture and components

```
app/editor/page.tsx (server) ──────────────┐
app/editor/[projectId]/page.tsx (server) ──┤→ components/editor/* (client + one server data component) → hooks/useProjectDialogs → app/editor/actions.ts (F03)
                                           └→ lib/access.ts, lib/projects/queries.ts (F03), lib/auth.ts (F02)
```

| File | New/Modified | Server/client | Responsibility |
|---|---|---|---|
| `app/editor/page.tsx` | modified (F01 placeholder, F02 gate) | server | `<EditorShell sidebar={…} navbarRight={<UserMenu/>}><Suspense fallback={<SidebarSkeleton/>}><ProjectSidebarData/></Suspense><EmptyState/><ProjectDialogsHost/></EditorShell>` — `EditorShell` is F01's; the lists stream into its `sidebar.myProjects/shared` slots |
| `app/editor/[projectId]/page.tsx` | new | server | `WorkspacePage` + `WorkspaceGate` (Suspense child; calls the F13 seed hook after the access check) |
| `app/editor/[projectId]/error.tsx` | new | client | segment error boundary (`{ error, retry }`) |
| `lib/editor/seed-hook.ts` | new (replaced by F13) | server | `seedRoomIfEmpty(project)` no-op stub with the D-034 signature; F13 moves the real implementation into `lib/liveblocks-flow.ts` and this file re-exports it |
| `components/editor/editor-shell.tsx` | modified (F01) | client | `useEditorChrome()` gains `setSidebarOpen`/`setAiOpen`; viewport-width default (open ≥ 1024 px); reduced-motion flag |
| `components/editor/editor-navbar.tsx` | modified (F01) | client | adds `center` content for the project name, `Archived` badge, `saveStatusSlot`/`importSlot`/`shareSlot`, AI toggle (`Sparkles`, `aria-label="Toggle AI sidebar"`); the F01 sidebar toggle is unchanged |
| `components/editor/project-sidebar-data.tsx` | new | server | `requireUser()` → both lists → `<ProjectSidebar owned shared currentProjectId />` |
| `components/editor/project-sidebar.tsx` | modified (F01) | client | adds counts, list items, `aria-current`, owner dropdown; keeps F01's tabs, empty copy, New Project, `SidebarPanel` scrim |
| `components/editor/project-dialogs.tsx` | new | client | `CreateProjectDialog`, `RenameProjectDialog`, `DeleteProjectDialog` built on F01's `AppDialog`/`ConfirmDialog`; `ProjectDialogsHost` (reads dialog state from a context created by the hook) |
| `hooks/useProjectDialogs.ts` | new | client | state machine + action calls |
| `components/editor/empty-state.tsx` | modified (F01) | client wrapper | F01's `EmptyState` with the New Project action wired to `openCreate` |
| `components/editor/access-denied.tsx` | new | server-safe | static component |
| `components/editor/workspace.tsx` | new | client | layout with slots, composed from F01's `EditorShell` |
| `components/editor/workspace-skeleton.tsx` | new | server-safe | Suspense fallback |
| `components/canvas/canvas-placeholder.tsx` | new (F06 replaces usage) | client | dot background + text |
| `components/ai/ai-sidebar.tsx` | reused (F01; F16 fills body) | client | right panel with header "AI Workspace" / "Collaborate with drawArc"; mounted through `EditorShell`'s `aiSidebar` prop with `role`/`projectId` |
| `tests/e2e/editor-home.spec.ts`, `tests/e2e/workspace-gate.spec.ts`, `tests/unit/*.test.tsx` | new | — | see 05-test-plan.md |

Dialog state is shared between the sidebar, the empty state, and the dialogs host through `ProjectDialogsProvider` (created in the hook file) so one hook instance serves the page. The provider is mounted inside F01's `EditorShell`. No F01 component is re-created under a new name; F04 modifies F01's files and keeps their exported names and copy.

## Domain model and TypeScript contracts

```ts
// components/editor/workspace.tsx
import type { ProjectRole } from '@/lib/access';
export interface WorkspaceCurrentUser { id: string; name: string | null; avatarUrl: string | null }
export interface EditorIslandProps { projectId: string; role: ProjectRole; currentUser: WorkspaceCurrentUser }   // F06 contract — do not extend here
export interface WorkspaceProps {
  project: { id: string; name: string; status: 'ACTIVE' | 'ARCHIVED' };
  role: ProjectRole;                       // real role (owner/editor/viewer) for chrome affordances
  currentUser: WorkspaceCurrentUser;
  sidebar: React.ReactNode;                // <Suspense><ProjectSidebarData currentProjectId/></Suspense>
  canvas?: React.ReactNode;                // F06 passes <CanvasEditor {...islandProps}/>; default <CanvasPlaceholder/>
  shareSlot?: React.ReactNode;             // F12
  importSlot?: React.ReactNode;            // F14
  saveStatusSlot?: React.ReactNode;        // F13
  presenceSlot?: React.ReactNode;          // F11 passes <PresenceStack/> (which contains the UserButton); default <UserMenu/>
  aiSidebar?: React.ReactNode;             // F16 (body only); default = F01 AiSidebar placeholder body
  seed?: SeedResult;                       // F13 (D-034): { seeded, snapshotExists, savedAt, warning } from the gate's seed step
}
// islandProps derived inside the server page: role: project.status === 'ARCHIVED' ? 'viewer' : role

// hooks/useProjectDialogs.ts
export type DialogState = null | { kind: 'create' } | { kind: 'rename'; project: ProjectListItem } | { kind: 'delete'; project: ProjectListItem };
export interface ProjectDialogsApi {
  dialog: DialogState; name: string; pending: boolean; error: ActionError | null;
  openCreate(): void; openRename(p: ProjectListItem): void; openDelete(p: ProjectListItem): void; close(): void;
  setName(v: string): void; submit(): void;
}
```

`ProjectListItem` and `ActionError` come from F03 (`lib/projects/queries.ts`, `lib/errors.ts`). No Zod schemas are introduced here; client-side the only pre-check is `maxLength=100` on the input (server remains authoritative).

## Data and state ownership

| State | Owner | Notes |
|---|---|---|
| Project lists | Postgres via F03 cached queries | rendered server-side; the client never fetches lists |
| Current project name/status/role | Postgres via gate | passed as props; refreshed by the action response re-render |
| Sidebar open / AI open | client memory (context) | ephemeral; default by viewport width; not persisted (no `localStorage` in M1) |
| Dialog/form state | client memory (hook) | reset on open |
| Current project id | server page prop | never read from `useParams` (FR-018) |

No new derived copies of tenant data are introduced.

## API and integration contracts

Pages and gate (binding code shape):

```tsx
// app/editor/[projectId]/page.tsx
import { Suspense } from 'react';
export default function WorkspacePage(props: PageProps<'/editor/[projectId]'>) {
  return <Suspense fallback={<WorkspaceSkeleton />}><WorkspaceGate params={props.params} /></Suspense>;
}
async function WorkspaceGate({ params }: Pick<PageProps<'/editor/[projectId]'>, 'params'>) {
  const { projectId } = await params;
  let access;
  try { access = await requireProjectRole(projectId, 'viewer'); }
  catch (err) {
    if (err instanceof AccessError && err.code === 'UNAUTHENTICATED') redirect(`/sign-in?redirect_url=${encodeURIComponent(`/editor/${projectId}`)}`);  // same URL requireUser({ unauthenticated: 'redirect', returnTo }) would build
    if (err instanceof AccessError) return <AccessDenied />;   // FORBIDDEN / NOT_FOUND — identical output
    throw err;                                                 // unexpected → error.tsx
  }
  const { user, project, role } = access;
  // Seed step — hook point owned by F13 (D-034): reads the room via getStorageDocument; if 0 nodes & 0 edges and a snapshot
  // exists, validates + migrates + seeds via mutateFlow (storageKey 'flow') BEFORE rendering. F04 ships a no-op stub.
  const seed = await seedRoomIfEmpty({ id: project.id, canvasBlobPath: project.canvasBlobPath, canvasSchemaVersion: project.canvasSchemaVersion });
  const islandProps: EditorIslandProps = { projectId: project.id, role: project.status === 'ARCHIVED' ? 'viewer' : role, currentUser: { id: user.id, name: user.name, avatarUrl: user.avatarUrl } };
  return <Workspace project={project} role={role} currentUser={islandProps.currentUser} seed={seed} sidebar={<Suspense fallback={<SidebarSkeleton/>}><ProjectSidebarData currentProjectId={project.id} /></Suspense>} canvas={<CanvasPlaceholder {...islandProps} />} />;
}
```

`requireUser` contract (settled, F02 D-F02-2 / security-model.md): `requireProjectRole` calls `requireUser()` in its default `'throw'` mode, so an anonymous visitor surfaces here as `AccessError('UNAUTHENTICATED')` and the gate performs the page-level redirect with the `returnTo` URL; there is no `NEXT_REDIRECT` branch to handle. `redirect()` is called before any output. `seedRoomIfEmpty` returns `{ seeded: boolean; snapshotExists: boolean; savedAt: string | null; warning: 'SEED_FAILED' | 'SNAPSHOT_INVALID' | null }` and never throws (failures become `warning`, F13 FR-016).

Server Actions consumed (F03): `createProject`, `renameProject`, `deleteProject`. `archiveProject`/`unarchiveProject` are not called by F04.

Hook submit flow:

```ts
submit = () => { if (pending || !dialog) return;
  startTransition(async () => {
    const result = dialog.kind === 'create' ? await createProject({ name }).catch(toClientError)
                 : dialog.kind === 'rename' ? await renameProject({ projectId: dialog.project.id, name }).catch(toClientError)
                 : await deleteProject({ projectId: dialog.project.id }).catch(toClientError);
    if (!result.ok) { setError(result.error); return; }
    close();
    if (dialog.kind === 'create') router.push(`/editor/${result.data.id}`);
    if (dialog.kind === 'delete' && dialog.project.id === currentProjectId) router.push('/editor');
  }); };
// toClientError: rejected promise (network, "Failed to find Server Action") → { ok: false, error: { code: 'UPSTREAM', message: 'The app was updated. Please reload and try again.' } }
```

Links: every sidebar item is `<Link prefetch={true}>` (partialPrefetching doc L57: per-link prefetch resolves param-dependent content); the "Back to projects" link uses default prefetch.

Slots contract (D-028): the server page composes slots; `Workspace` renders `shareSlot ?? null`, `importSlot ?? null`, `saveStatusSlot ?? null`, `presenceSlot ?? <UserMenu/>` (the slot *replaces* the default user button — F11's `PresenceStack` includes it), `aiSidebar ?? <AiSidebar/>` (F01's placeholder body), `canvas ?? <CanvasPlaceholder/>`; `seed.warning` is rendered by F13's banner inside the canvas area (F04 renders nothing for it).

## Security and validation

- The gate is the only authorization point; `AccessDenied` is returned for `FORBIDDEN` and `NOT_FOUND` alike, with no project-specific content and the same HTTP status (200) — no existence oracle via status code, body, or timing beyond the DB lookup (which `getProjectRole` performs for both valid-cuid cases).
- Client affordances (dropdown, dialogs) are hidden for non-owners but every action is re-authorized by F03; hiding is UX, not security.
- `redirect_url` is built from the validated route param only (the gate's `projectId`), never from a query string, so it cannot be an open redirect.
- No user input is rendered unescaped; project names are plain text in React.
- `error.tsx` never prints `error.message` from the server (Next replaces it with a generic message + `digest`).

## Verified library facts this design relies on

| Fact | Source | Date checked |
|---|---|---|
| `params` is a Promise; await it inside a Suspense child; `Pick<PageProps<...>, 'params'>` pattern | `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` L656–714, L787–821 | 2026-10-22 |
| `usePathname`/`useParams`/`useSearchParams` need Suspense on dynamic routes or the build fails | same guide L716–723 | 2026-10-22 |
| `<Link prefetch={true}>` opts a link into per-link prefetching under `partialPrefetching` | `.../05-config/01-next-config-js/partialPrefetching.md` L57 | 2026-10-22 |
| Server Actions dispatch sequentially from a client; call from event handlers inside `startTransition` | `.../02-guides/server-actions.md` L20–32 | 2026-10-22 |
| Action with `updateTag` returns the re-rendered route in the same response | same L34–74 | 2026-10-22 |
| "Failed to find Server Action" after deploy; surface as retry | same L172–180 | 2026-10-22 |
| `error.tsx` is `'use client'`, props `{ error, retry }`; `retry` stable in 16.3 | `.../03-file-conventions/error.md` L102–157, L331 | 2026-10-22 |
| `@next/playwright` `instant()` asserts static shell before dynamic content | `.../02-guides/instant-navigation.md` L310–372 | 2026-10-22 |
| `redirect()` throws; place after revalidation in actions, callable in Server Components | `.../04-functions/redirect.md` (standard behaviour) | 2026-10-22 |
| UNVERIFIED: `@axe-core/playwright` compatibility with Playwright 1.64 — check at T-009; fallback is keyboard-only assertions. | — | — |
