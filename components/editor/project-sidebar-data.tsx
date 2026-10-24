import { ProjectList } from '@/components/editor/project-list';
import { ProjectSidebarTabs } from '@/components/editor/project-sidebar';
import { type AuthUser, requireUser } from '@/lib/auth';
import { listMyProjects, listSharedProjects } from '@/lib/projects/queries';
import { EmailHeldError } from '@/lib/users';

/**
 * Server half of the project sidebar (FR-001, FR-002): render it inside `<Suspense>` — it reads the session.
 * The lists come from F03's cached queries, keyed by the authenticated user's id only.
 */
export async function ProjectSidebarData({ currentProjectId }: { currentProjectId?: string }) {
  let user: AuthUser;
  try {
    ({ user } = await requireUser({ unauthenticated: 'redirect' }));
  } catch (err) {
    // The editor home renders its own screen for a held email (F02 FR-018); the sidebar just stays empty.
    if (err instanceof EmailHeldError) return <ProjectSidebarTabs myCount={0} sharedCount={0} />;
    throw err;
  }
  const [owned, shared] = await Promise.all([listMyProjects(user.id), listSharedProjects(user.id)]);
  return (
    <ProjectSidebarTabs
      myCount={owned.length}
      sharedCount={shared.length}
      myProjects={owned.length > 0 ? <ProjectList items={owned} currentProjectId={currentProjectId} /> : undefined}
      shared={shared.length > 0 ? <ProjectList items={shared} currentProjectId={currentProjectId} /> : undefined}
    />
  );
}
