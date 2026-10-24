import type { ProjectRole } from '@/lib/access';
import type { ProjectStatus } from '@/lib/generated/prisma/enums';

export interface WorkspaceCurrentUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

/** The canvas island contract (F06): exactly these keys — do not extend here (FR-014). */
export interface EditorIslandProps {
  projectId: string;
  role: ProjectRole;
  currentUser: WorkspaceCurrentUser;
}

/** Archived projects are read-only, so the island always gets `viewer` for them (EC-003). */
export function toIslandProps(
  user: WorkspaceCurrentUser,
  project: { id: string; status: ProjectStatus },
  role: ProjectRole,
): EditorIslandProps {
  return {
    projectId: project.id,
    role: project.status === 'ARCHIVED' ? 'viewer' : role,
    currentUser: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
  };
}
