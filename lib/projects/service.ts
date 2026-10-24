import 'server-only';

import type { AccessProject } from '@/lib/access';
import type { AuthUser } from '@/lib/auth';
import { AppError, PROJECT_ARCHIVED } from '@/lib/errors';
import type { ProjectStatus } from '@/lib/generated/prisma/client';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { CreateProjectInput, RenameProjectInput } from '@/schemas/project';

import type { ProjectExternals } from './externals';

/** The caller and the project `requireProjectRole` already authorized; cores never re-derive access. */
export interface ProjectContext {
  user: AuthUser;
  project: AccessProject;
}

async function bestEffort(
  level: 'warn' | 'error',
  op: keyof ProjectExternals,
  ctx: { projectId: string; userId: string },
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (err) {
    logger[level]({ ...ctx, op, err }, `externals.${op} failed; manual cleanup may be needed`);
  }
}

export async function createProjectCore(
  { user }: { user: AuthUser },
  input: CreateProjectInput,
  externals: ProjectExternals,
): Promise<{ id: string }> {
  const { id } = await prisma.project.create({
    data: { ownerId: user.id, name: input.name, description: input.description ?? null },
    select: { id: true },
  });
  // A missing room is not fatal: Liveblocks creates rooms on first connection (EC-008).
  await bestEffort('warn', 'ensureRoom', { projectId: id, userId: user.id }, () => externals.ensureRoom(id));
  return { id };
}

export async function renameProjectCore(
  { user, project }: ProjectContext,
  input: RenameProjectInput,
): Promise<{ id: string; name: string; description: string | null }> {
  if (project.status === 'ARCHIVED') throw new AppError('CONFLICT', undefined, { details: { reason: PROJECT_ARCHIVED } });
  // `status: ACTIVE` in the filter closes the archive race: a concurrent archive surfaces as P2025 (EC-012).
  return prisma.project.update({
    where: { id: project.id, ownerId: user.id, status: 'ACTIVE' },
    data: { name: input.name, ...(input.description !== undefined ? { description: input.description } : {}) },
    select: { id: true, name: true, description: true },
  });
}

/** Archive/unarchive; already being in the target state is a success (FR-010). */
export async function setProjectStatusCore(
  { user, project }: ProjectContext,
  status: ProjectStatus,
): Promise<{ id: string; status: ProjectStatus }> {
  if (project.status !== status) {
    await prisma.project.update({ where: { id: project.id, ownerId: user.id }, data: { status }, select: { id: true } });
  }
  return { id: project.id, status };
}

/**
 * Deletes the row (members cascade), then best-effort clean-up in the order kick → snapshot → room so
 * connected clients leave before their room disappears (FR-011, EC-010). External failures are logged
 * with the project id and never fail the deletion (EC-009).
 */
export async function deleteProjectCore({ user, project }: ProjectContext, externals: ProjectExternals): Promise<{ id: string }> {
  const members = await prisma.projectMember.findMany({
    where: { projectId: project.id, userId: { not: null } },
    select: { userId: true },
  });
  await prisma.project.delete({ where: { id: project.id, ownerId: user.id }, select: { id: true } });

  const ctx = { projectId: project.id, userId: user.id };
  const userIds = [project.ownerId, ...members.flatMap((m) => (m.userId ? [m.userId] : []))];
  await bestEffort('error', 'kickUsers', ctx, () => externals.kickUsers(project.id, userIds));
  await bestEffort('error', 'deleteSnapshot', ctx, () => externals.deleteSnapshot(project.id));
  await bestEffort('error', 'deleteRoom', ctx, () => externals.deleteRoom(project.id));
  return { id: project.id };
}
