import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { CanvasEditor } from '@/components/canvas/canvas-editor';
import { throwIfProbed } from '@/components/e2e/boundary-probe';
import { PresenceStack } from '@/components/canvas/presence-stack';
import { AccessDenied } from '@/components/editor/access-denied';
import { ImportTemplateSlot } from '@/components/editor/import-template-dialog';
import { ProjectSidebarData } from '@/components/editor/project-sidebar-data';
import { ShareButton } from '@/components/editor/share-button';
import { SidebarSkeleton } from '@/components/editor/sidebar-skeleton';
import { Workspace } from '@/components/editor/workspace';
import { WorkspaceSkeleton } from '@/components/editor/workspace-skeleton';
import { requireProjectRole } from '@/lib/access';
import { signInUrl } from '@/lib/auth';
import { seedRoomIfEmpty } from '@/lib/editor/seed-hook';
import { toIslandProps } from '@/lib/editor/island-props';
import { AccessError } from '@/lib/errors';
import { listProjectMembers, membersVisibleTo } from '@/lib/projects/members';
import { newRequestId } from '@/lib/request-id';

// `params` is awaited only inside the Suspense child (code-standards rule 1), so the skeleton is the static shell.
export default function WorkspacePage(props: PageProps<'/editor/[projectId]'>) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <WorkspaceGate params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

/**
 * The single authorization point for the workspace (FR-009–FR-011): sign-in redirect for visitors, the same
 * AccessDenied for malformed / missing / foreign projects, and the workspace for members. Only `AccessError`
 * is handled; anything else propagates to error.tsx.
 */
async function WorkspaceGate({ params, searchParams }: Pick<PageProps<'/editor/[projectId]'>, 'params' | 'searchParams'>) {
  const { projectId } = await params;
  let access: Awaited<ReturnType<typeof requireProjectRole>>;
  try {
    access = await requireProjectRole(projectId, 'viewer');
  } catch (err) {
    // The return URL is built from the route param only and checked by signInUrl (no open redirect).
    if (err instanceof AccessError && err.code === 'UNAUTHENTICATED') redirect(signInUrl(`/editor/${projectId}`));
    if (err instanceof AccessError) return <AccessDenied />;
    throw err;
  }
  const { user, project, role } = access;
  // E2E-only segment-boundary probe (F15 AC-013): members only, after the gate; a no-op in production builds.
  await throwIfProbed(searchParams, 'segment');

  // Seed step (F13, D-034): restores an empty room from the Blob snapshot before rendering, for any role.
  // Never throws; a Liveblocks/Blob failure becomes `seed.warning` and the next open retries (P-13-8).
  const seed = await seedRoomIfEmpty(
    {
      id: project.id,
      canvasBlobPath: project.canvasBlobPath,
      canvasSchemaVersion: project.canvasSchemaVersion,
      canvasSavedAt: project.canvasSavedAt,
    },
    { userId: user.id, requestId: newRequestId() },
  );
  const islandProps = toIslandProps(user, project, role);
  // F12: only after the gate above (listProjectMembers performs no authorization itself).
  const members = membersVisibleTo(await listProjectMembers(project.id), role);

  return (
    <Workspace
      project={{ id: project.id, name: project.name, status: project.status }}
      role={role}
      currentUser={islandProps.currentUser}
      seed={seed}
      shareSlot={<ShareButton projectId={project.id} projectStatus={project.status} role={role} members={members} />}
      sidebar={
        <Suspense fallback={<SidebarSkeleton />}>
          <ProjectSidebarData currentProjectId={project.id} />
        </Suspense>
      }
      // F14: owners and editors only; the in-canvas control also requires a writable room token.
      importSlot={role === 'viewer' ? undefined : <ImportTemplateSlot />}
      canvas={<CanvasEditor {...islandProps} />}
      presenceSlot={<PresenceStack />}
    />
  );
}
