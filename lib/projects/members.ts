import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { ProjectRole } from '@/lib/access';
import { AppError } from '@/lib/errors';
import type { MemberRole } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';

import { membersTag } from './tags';

/** One row of the Share dialog. `pending` = invited by email, not bound to a live account yet. */
export interface MemberListItem {
  id: string;
  email: string;
  role: 'editor' | 'viewer';
  status: 'active' | 'pending';
  name: string | null;
  avatarUrl: string | null;
  invitedAt: string;
}

export interface ProjectMembers {
  owner: { id: string; name: string | null; email: string; avatarUrl: string | null };
  members: MemberListItem[];
}

export const toMemberRole = (role: MemberRole): 'editor' | 'viewer' => (role === 'EDITOR' ? 'editor' : 'viewer');
export const toPrismaRole = (role: 'editor' | 'viewer'): MemberRole => (role === 'editor' ? 'EDITOR' : 'VIEWER');

/** The member columns every list row needs; shared by the list and the action results. */
export const MEMBER_SELECT = {
  id: true,
  email: true,
  role: true,
  invitedAt: true,
  user: { select: { name: true, avatarUrl: true, deletedAt: true } },
} as const;

interface MemberRow {
  id: string;
  email: string;
  role: MemberRole;
  invitedAt: Date;
  user: { name: string | null; avatarUrl: string | null; deletedAt: Date | null } | null;
}

/** A row bound to a deleted user renders as pending by email (EC-017): its profile is no longer shown. */
export function toMemberListItem(row: MemberRow): MemberListItem {
  const live = row.user && !row.user.deletedAt ? row.user : null;
  return {
    id: row.id,
    email: row.email,
    role: toMemberRole(row.role),
    status: live ? 'active' : 'pending',
    name: live?.name ?? null,
    avatarUrl: live?.avatarUrl ?? null,
    invitedAt: row.invitedAt.toISOString(),
  };
}

/**
 * The owner plus every member ordered by `invitedAt` (FR-008). Performs no authorization: the workspace gate
 * calls it only after `requireProjectRole` succeeded (security-model rule 4).
 */
export async function listProjectMembers(projectId: string): Promise<ProjectMembers> {
  'use cache';
  cacheLife('minutes');
  cacheTag(membersTag(projectId));
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: { orderBy: [{ invitedAt: 'asc' }, { id: 'asc' }], select: MEMBER_SELECT },
    },
  });
  if (!project) throw new AppError('NOT_FOUND');
  return { owner: project.owner, members: project.members.map(toMemberListItem) };
}

/**
 * What a caller with `role` may see (FR-008 UX): the owner sees every email; editors and viewers see names for
 * bound members and an email only where there is nothing else to show (pending rows, nameless accounts).
 */
export function membersVisibleTo(list: ProjectMembers, role: ProjectRole): ProjectMembers {
  if (role === 'owner') return list;
  const hide = (email: string, name: string | null) => (name ? '' : email);
  return {
    owner: { ...list.owner, email: hide(list.owner.email, list.owner.name) },
    members: list.members.map((m) => (m.status === 'active' ? { ...m, email: hide(m.email, m.name) } : m)),
  };
}

/** Invitations sent by `inviterId` since `since` that still exist (rate limit, EC-004). */
export function countRecentInvites(inviterId: string, since: Date): Promise<number> {
  return prisma.projectMember.count({ where: { invitedById: inviterId, invitedAt: { gte: since } } });
}
