import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { errorResponse } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

const MAX_IDS = 50;

const ResolveQuery = z
  .string()
  .transform((raw) => [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))])
  .pipe(z.array(z.cuid()).min(1).max(MAX_IDS));

/**
 * Backend of the Liveblocks `resolveUsers` callback (FR-008, P-05-4). Returns name and avatar only for users
 * who share at least one live project with the caller; any other id is silently omitted (EC-012), so the
 * route cannot be used to enumerate accounts.
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { user } = await requireUser();
    const ids = ResolveQuery.parse(request.nextUrl.searchParams.get('ids') ?? '');

    // A project the caller can open: owned by them, or one where they hold a bound membership.
    const sharedWithCaller = { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] };
    const rows = await prisma.user.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        OR: [
          { ownedProjects: { some: sharedWithCaller } },
          { memberships: { some: { project: sharedWithCaller } } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    const users = rows.map((row) => ({ id: row.id, name: row.name ?? row.email, avatar: row.avatarUrl }));
    return Response.json({ users }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (err) {
    return errorResponse(err);
  }
}
