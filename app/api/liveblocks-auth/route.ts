import { z } from 'zod';

import { requireProjectRole } from '@/lib/access';
import { AccessError } from '@/lib/errors';
import { getLiveblocks, userColor } from '@/lib/liveblocks';
import { logger } from '@/lib/logger';

// Room ids are project cuids (Prisma `cuid()`); anything else is refused before a query runs (EC-001).
const AuthBody = z.object({ room: z.string().regex(/^c[a-z0-9]{24}$/) });

const NO_STORE = { 'Cache-Control': 'no-store' };
const NAME_MAX = 80;

/**
 * Liveblocks' "forbidden" body (P-05-5): the client disconnects instead of retrying. It deliberately differs
 * from the app-wide `{ error: { code, message } }` envelope because the Liveblocks client protocol requires it.
 */
function forbidden(reason: 'unauthenticated' | 'invalid_room' | 'no_access', status: 401 | 403): Response {
  return Response.json({ error: 'forbidden', reason }, { status, headers: NO_STORE });
}

/**
 * Mints a room token whose permissions come from the caller's Postgres role on every call (FR-005, D-015):
 * viewers (and everyone on an archived project) read, owners and editors write. Never cached (FR-007).
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = request.headers.get('x-vercel-id') ?? undefined;
  const parsed = AuthBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return forbidden('invalid_room', 403);
  const { room } = parsed.data;

  let access: Awaited<ReturnType<typeof requireProjectRole>>;
  try {
    access = await requireProjectRole(room, 'viewer');
  } catch (err) {
    if (!(err instanceof AccessError)) throw err;
    const unauthenticated = err.code === 'UNAUTHENTICATED';
    logger.info({ requestId, projectId: room, reason: err.code }, 'liveblocks auth denied');
    return unauthenticated ? forbidden('unauthenticated', 401) : forbidden('no_access', 403);
  }

  const { user, project, role } = access;
  // Archived projects are read-only for everyone (security-model rule 5); the owner unarchives first.
  const canWrite = role !== 'viewer' && project.status !== 'ARCHIVED';
  try {
    const session = getLiveblocks().prepareSession(user.id, {
      userInfo: {
        name: (user.name ?? user.email).slice(0, NAME_MAX),
        ...(user.avatarUrl ? { avatar: user.avatarUrl } : {}),
        color: userColor(user.id),
      },
    });
    session.allow(room, canWrite ? ['*:write'] : ['*:read']);
    const { status, body } = await session.authorize();
    return new Response(body, { status, headers: { ...NO_STORE, 'Content-Type': 'application/json' } });
  } catch (err) {
    // Not the forbidden body: the client retries with backoff (EC-016).
    logger.error({ requestId, userId: user.id, projectId: room, err }, 'liveblocks authorize failed');
    return Response.json(
      { error: { code: 'UPSTREAM', message: 'Could not connect to the collaboration service.' } },
      { status: 502, headers: NO_STORE },
    );
  }
}
