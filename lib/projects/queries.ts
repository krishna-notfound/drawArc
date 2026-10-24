import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { ProjectRole } from '@/lib/access';
import { prisma } from '@/lib/prisma';

import { ownedTag, projectTag, sharedTag } from './tags';

/** Serialisable list row for the editor sidebar (F04). */
export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: string;
  role: ProjectRole;
  ownerName: string | null;
}

/** Projects the user owns. `userId` must come from `requireUser()` in the caller, never from request input. */
export async function listMyProjects(userId: string): Promise<ProjectListItem[]> {
  'use cache';
  cacheLife('minutes');
  const rows = await prisma.project.findMany({
    where: { ownerId: userId, status: 'ACTIVE', owner: { deletedAt: null } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, updatedAt: true, owner: { select: { name: true } } },
  });
  cacheTag(ownedTag(userId), ...rows.map((r) => projectTag(r.id)));
  return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt.toISOString(), role: 'owner', ownerName: r.owner.name }));
}

/** Projects shared with the user through a bound membership — never matched by email (EC-017). */
export async function listSharedProjects(userId: string): Promise<ProjectListItem[]> {
  'use cache';
  cacheLife('minutes');
  const rows = await prisma.project.findMany({
    where: { status: 'ACTIVE', owner: { deletedAt: null }, members: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      owner: { select: { name: true } },
      members: { where: { userId }, select: { role: true } },
    },
  });
  cacheTag(sharedTag(userId), ...rows.map((r) => projectTag(r.id)));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    updatedAt: r.updatedAt.toISOString(),
    role: r.members[0]?.role === 'EDITOR' ? 'editor' : 'viewer',
    ownerName: r.owner.name,
  }));
}
