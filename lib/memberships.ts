import 'server-only';

import type { AuthUser } from './auth';
import { prisma } from './prisma';

type MembershipDb = Pick<typeof prisma, 'projectMember'>;

/**
 * Binds every pending `ProjectMember` row invited by `user.email` to `user.id` (PRD-011, D-011). Called by
 * `requireUser` on first sync and by the Clerk user webhooks; `getProjectRole` binds single rows lazily.
 * Rows already bound to someone else are never touched (EC-006).
 */
export async function bindPendingMemberships(user: AuthUser, db: MembershipDb = prisma): Promise<{ bound: number }> {
  const { count } = await db.projectMember.updateMany({
    where: { email: user.email.toLowerCase(), userId: null },
    data: { userId: user.id, acceptedAt: new Date() },
  });
  return { bound: count };
}

/** A deleted user's memberships are removed (security-model "Deletion lifecycle"); owned projects stay. */
export async function removeMembershipsOfDeletedUser(clerkId: string, db: MembershipDb = prisma): Promise<{ removed: number }> {
  const { count } = await db.projectMember.deleteMany({ where: { user: { clerkId } } });
  return { removed: count };
}
