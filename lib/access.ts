import 'server-only';

import { ProjectIdSchema } from '@/schemas/project';

import { type AuthUser, requireUser } from './auth';
import { AccessError } from './errors';
import type { ProjectStatus } from './generated/prisma/client';
import { prisma } from './prisma';

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export const ROLE_RANK: Record<ProjectRole, number> = { viewer: 0, editor: 1, owner: 2 };

export interface AccessUser {
  id: string;
  email: string;
}

export interface AccessProject {
  id: string;
  ownerId: string;
  name: string;
  status: ProjectStatus;
  /** Snapshot pointer (F13), read by the workspace gate's seed step (D-034). */
  canvasBlobPath: string | null;
  canvasSchemaVersion: number | null;
  /** Time of the last successful snapshot write; drives the PUT minimum interval (P-13-2) and "Saved HH:MM". */
  canvasSavedAt: Date | null;
}

const MEMBER_ROLE = { EDITOR: 'editor', VIEWER: 'viewer' } as const satisfies Record<string, ProjectRole>;

/**
 * The single role resolver (domain-model invariant 3). `null` means no access: a malformed id (no query
 * runs), a missing project, a project whose owner was deleted, or no matching membership. A membership
 * matched by email only is bound to the user in the same call; the `userId: null` guard makes concurrent
 * binds idempotent (FR-004, FR-005).
 */
export async function resolveProjectAccess(
  user: AccessUser,
  projectId: string,
): Promise<{ project: AccessProject; role: ProjectRole } | null> {
  if (!ProjectIdSchema.safeParse(projectId).success) return null;

  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      status: true,
      canvasBlobPath: true,
      canvasSchemaVersion: true,
      canvasSavedAt: true,
      owner: { select: { deletedAt: true } },
    },
  });
  if (!row || row.owner.deletedAt) return null;
  const project: AccessProject = {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    status: row.status,
    canvasBlobPath: row.canvasBlobPath,
    canvasSchemaVersion: row.canvasSchemaVersion,
    canvasSavedAt: row.canvasSavedAt,
  };
  if (project.ownerId === user.id) return { project, role: 'owner' };

  const email = user.email.toLowerCase();
  const members = await prisma.projectMember.findMany({
    where: { projectId, OR: [{ userId: user.id }, { userId: null, email }] },
    select: { id: true, userId: true, role: true },
  });
  const bound = members.find((m) => m.userId === user.id);
  if (bound) return { project, role: MEMBER_ROLE[bound.role] };

  const pending = members.find((m) => m.userId === null);
  if (!pending) return null;
  await prisma.projectMember.updateMany({
    where: { id: pending.id, userId: null },
    data: { userId: user.id, acceptedAt: new Date() },
  });
  return { project, role: MEMBER_ROLE[pending.role] };
}

export async function getProjectRole(user: AccessUser, projectId: string): Promise<ProjectRole | null> {
  return (await resolveProjectAccess(user, projectId))?.role ?? null;
}

/**
 * Authenticates, then requires at least `atLeast` on the project. Missing and foreign projects throw the
 * same `FORBIDDEN` (no existence leak, security-model rule 3). Archived projects refuse `editor`-level
 * work; `viewer` reads and `owner` lifecycle actions (unarchive, delete) still pass (FR-007).
 */
export async function requireProjectRole(
  projectId: string,
  atLeast: ProjectRole,
): Promise<{ user: AuthUser; project: AccessProject; role: ProjectRole }> {
  const { user } = await requireUser();
  const access = await resolveProjectAccess(user, projectId);
  if (!access || ROLE_RANK[access.role] < ROLE_RANK[atLeast]) throw new AccessError('FORBIDDEN');
  if (access.project.status === 'ARCHIVED' && atLeast === 'editor') throw new AccessError('FORBIDDEN', 'PROJECT_ARCHIVED');
  return { user, ...access };
}
