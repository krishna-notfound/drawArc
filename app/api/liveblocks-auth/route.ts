import { z } from 'zod';

import { requireProjectRole } from '@/lib/access';
import { AccessError, AppError, errorResponse } from '@/lib/errors';
import { getLiveblocks, userColor } from '@/lib/liveblocks';
import { withRequest } from '@/lib/request-id';

// Room ids are project cuids (Prisma `cuid()`); anything else is refused before a query runs (EC-001).
const AuthBody = z.object({ room: z.string().regex(/^c[a-z0-9]{24}$/) });

const NO_STORE = { 'Cache-Control': 'no-store' };
const NAME_MAX = 80;

/**
 * Liveblocks' "forbidden" body (P-05-5): the client disconnects instead of retrying. It deliberately differs
 * from the app-wide `{ error: { code, message } }` envelope because the Liveblocks client protocol requires it;
 * the client ignores the extra `requestId` (F15 FR-007).
 */
function forbidden(
  reason: 'unauthenticated' | 'invalid_room' | 'no_access',
  status: 401 | 403,
  requestId: string,
): Response {
  return Response.json({ error: 'forbidden', reason, requestId }, { status, headers: NO_STORE });
}

/**
 * Mints a room token whose permissions come from the caller's Postgres role on every call (FR-005, D-015):
 * viewers (and everyone on an archived project) read, owners and editors write. Never cached (FR-007).
 */
export const POST = withRequest(async (ctx, request: Request) => {
  const parsed = AuthBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return forbidden('invalid_room', 403, ctx.requestId);
  const { room } = parsed.data;
  ctx.bind({ projectId: room });

  let access: Awaited<ReturnType<typeof requireProjectRole>>;
  try {
    access = await requireProjectRole(room, 'viewer');
  } catch (err) {
    if (!(err instanceof AccessError)) throw err;
    const unauthenticated = err.code === 'UNAUTHENTICATED';
    ctx.log.info({ reason: err.code }, 'liveblocks auth denied');
    return unauthenticated
      ? forbidden('unauthenticated', 401, ctx.requestId)
      : forbidden('no_access', 403, ctx.requestId);
  }

  const { user, project, role } = access;
  ctx.bind({ userId: user.id });
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
    ctx.log.error({ err }, 'liveblocks authorize failed');
    return errorResponse(new AppError('UPSTREAM', 'Could not connect to the collaboration service.'), {
      requestId: ctx.requestId,
      headers: NO_STORE,
    });
  }
});
