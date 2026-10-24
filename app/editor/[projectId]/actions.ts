'use server';

import { updateTag } from 'next/cache';

import { getProjectRole, type ProjectRole, requireProjectRole } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { AccessError, type ActionResult, toActionError } from '@/lib/errors';
import { changeMemberRoleCore, inviteMemberCore, removeMemberCore } from '@/lib/projects/member-service';
import type { MemberListItem } from '@/lib/projects/members';
import { membersTag, sharedTag } from '@/lib/projects/tags';
import { newRequestId } from '@/lib/request-id';
import { ChangeMemberRoleInput, CheckMyAccessInput, InviteMemberInput, RemoveMemberInput } from '@/schemas/member';

// Same skeleton as app/editor/actions.ts: authenticate → parse → authorize (owner) → mutate → updateTag, and
// never throw for an expected failure. Inputs are `unknown`: a Server Action is a public endpoint.

type Ctx = { op: string; requestId: string; userId?: string; projectId?: string };

function invalidate(projectId: string, boundUserId: string | null): void {
  updateTag(membersTag(projectId));
  if (boundUserId) updateTag(sharedTag(boundUserId));
}

export async function inviteMember(raw: unknown): Promise<ActionResult<MemberListItem>> {
  const ctx: Ctx = { op: 'inviteMember', requestId: newRequestId() };
  try {
    const { user } = await requireUser();
    ctx.userId = user.id;
    const input = InviteMemberInput.parse(raw);
    ctx.projectId = input.projectId;
    const { project } = await requireProjectRole(input.projectId, 'owner');
    const { member, boundUserId } = await inviteMemberCore({ user, project }, input);
    invalidate(project.id, boundUserId);
    return { ok: true, data: member };
  } catch (err) {
    return { ok: false, error: toActionError(err, ctx) };
  }
}

export async function changeMemberRole(
  raw: unknown,
): Promise<ActionResult<{ member: MemberListItem; kickDelivered: boolean }>> {
  const ctx: Ctx = { op: 'changeMemberRole', requestId: newRequestId() };
  try {
    const { user } = await requireUser();
    ctx.userId = user.id;
    const input = ChangeMemberRoleInput.parse(raw);
    ctx.projectId = input.projectId;
    const { project } = await requireProjectRole(input.projectId, 'owner');
    const { member, kickDelivered, changed, boundUserId } = await changeMemberRoleCore({ user, project }, input);
    if (changed) invalidate(project.id, boundUserId);
    return { ok: true, data: { member, kickDelivered } };
  } catch (err) {
    return { ok: false, error: toActionError(err, ctx) };
  }
}

export async function removeMember(raw: unknown): Promise<ActionResult<{ memberId: string; kickDelivered: boolean }>> {
  const ctx: Ctx = { op: 'removeMember', requestId: newRequestId() };
  try {
    const { user } = await requireUser();
    ctx.userId = user.id;
    const input = RemoveMemberInput.parse(raw);
    ctx.projectId = input.projectId;
    const { project } = await requireProjectRole(input.projectId, 'owner');
    const { memberId, kickDelivered, boundUserId } = await removeMemberCore({ user, project }, input);
    invalidate(project.id, boundUserId);
    return { ok: true, data: { memberId, kickDelivered } };
  } catch (err) {
    return { ok: false, error: toActionError(err, ctx) };
  }
}

/**
 * Re-verification after a reconnect (D-032): the caller's current role, or the same `FORBIDDEN` for a missing
 * and a foreign project. Read-only; POST-only with session auth by virtue of being a Server Action.
 */
export async function checkMyAccess(raw: unknown): Promise<ActionResult<{ role: ProjectRole }>> {
  const ctx: Ctx = { op: 'checkMyAccess', requestId: newRequestId() };
  try {
    const { user } = await requireUser();
    ctx.userId = user.id;
    const input = CheckMyAccessInput.parse(raw);
    ctx.projectId = input.projectId;
    const role = await getProjectRole(user, input.projectId);
    if (!role) throw new AccessError('FORBIDDEN');
    return { ok: true, data: { role } };
  } catch (err) {
    return { ok: false, error: toActionError(err, ctx) };
  }
}
