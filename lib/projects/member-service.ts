import 'server-only';

import { AppError, PROJECT_ARCHIVED } from '@/lib/errors';
import { kickUser, notifyRoleChanged } from '@/lib/liveblocks';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { ChangeMemberRoleInput, InviteMemberInput, RemoveMemberInput } from '@/schemas/member';

import { countRecentInvites, MEMBER_SELECT, type MemberListItem, toMemberListItem, toMemberRole, toPrismaRole } from './members';
import type { ProjectContext } from './service';

export const SELF_INVITE = 'SELF_INVITE';
export const DUPLICATE_MEMBER = 'DUPLICATE_MEMBER';
export const INVITES_PER_HOUR = 20;
const HOUR_MS = 3_600_000;

const conflict = (reason: string, message?: string) => new AppError('CONFLICT', message, { details: { reason } });
const duplicate = (email: string) => conflict(DUPLICATE_MEMBER, `${email} already has access.`);
const memberGone = () => new AppError('NOT_FOUND', 'This member was already removed.');

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

/** → F05 `kickUser` (retries once, logs on final failure). `true` = delivered. */
export function broadcastKick(projectId: string, userId: string): Promise<boolean> {
  return kickUser(projectId, userId);
}

/** → F05 `notifyRoleChanged` (D-030: every effective role change, promotions included). */
export function broadcastRoleChanged(projectId: string, userId: string, role: 'editor' | 'viewer'): Promise<boolean> {
  return notifyRoleChanged(projectId, userId, role);
}

/**
 * Invites `input.email` (already normalised by the schema). Order is binding (02-design): archived → self →
 * duplicate → rate limit → bind to an existing account → insert (a lost race surfaces as P2002 → duplicate).
 */
export async function inviteMemberCore(
  { user, project }: ProjectContext,
  input: InviteMemberInput,
): Promise<{ member: MemberListItem; boundUserId: string | null }> {
  if (project.status === 'ARCHIVED') throw conflict(PROJECT_ARCHIVED);
  if (input.email === user.email.toLowerCase()) throw conflict(SELF_INVITE, 'You already own this project.');
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_email: { projectId: project.id, email: input.email } },
    select: { id: true },
  });
  if (existing) throw duplicate(input.email);
  if ((await countRecentInvites(user.id, new Date(Date.now() - HOUR_MS))) >= INVITES_PER_HOUR) {
    logger.warn({ projectId: project.id, userId: user.id, op: 'inviteMember' }, 'invitation rate limit reached');
    throw new AppError('RATE_LIMITED', "You've sent too many invitations. Try again in an hour.");
  }
  const bound = await prisma.user.findFirst({ where: { email: input.email, deletedAt: null }, select: { id: true } });
  try {
    const row = await prisma.projectMember.create({
      data: {
        projectId: project.id,
        email: input.email,
        role: toPrismaRole(input.role),
        invitedById: user.id,
        userId: bound?.id ?? null,
        acceptedAt: bound ? new Date() : null,
      },
      select: MEMBER_SELECT,
    });
    return { member: toMemberListItem(row), boundUserId: bound?.id ?? null };
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicate(input.email);
    throw err;
  }
}

export interface MemberChange {
  member: MemberListItem;
  /** False when the room event could not be delivered; the database change stands (FR-012). */
  kickDelivered: boolean;
  /** False for a same-role request: nothing was written, broadcast or invalidated (EC-013). */
  changed: boolean;
  boundUserId: string | null;
}

/** Re-roles a member; the broadcast runs only after the write committed (security-model "Revocation"). */
export async function changeMemberRoleCore({ project }: ProjectContext, input: ChangeMemberRoleInput): Promise<MemberChange> {
  if (project.status === 'ARCHIVED') throw conflict(PROJECT_ARCHIVED);
  // Scoped by project: a member id from another project is NOT_FOUND, after the caller's owner check.
  const current = await prisma.projectMember.findFirst({
    where: { id: input.memberId, projectId: project.id },
    select: { ...MEMBER_SELECT, userId: true },
  });
  if (!current) throw memberGone();
  if (toMemberRole(current.role) === input.role) {
    return { member: toMemberListItem(current), kickDelivered: true, changed: false, boundUserId: current.userId };
  }
  const { count } = await prisma.projectMember.updateMany({
    where: { id: current.id, projectId: project.id },
    data: { role: toPrismaRole(input.role) },
  });
  if (count === 0) throw memberGone(); // removed concurrently
  const member = toMemberListItem({ ...current, role: toPrismaRole(input.role) });
  const kickDelivered = current.userId ? await broadcastRoleChanged(project.id, current.userId, input.role) : true;
  return { member, kickDelivered, changed: true, boundUserId: current.userId };
}

/** Removes a member (allowed on archived projects, D-033) and KICKs their open sessions after the delete. */
export async function removeMemberCore(
  { project }: ProjectContext,
  input: RemoveMemberInput,
): Promise<{ memberId: string; kickDelivered: boolean; boundUserId: string | null }> {
  const current = await prisma.projectMember.findFirst({
    where: { id: input.memberId, projectId: project.id },
    select: { id: true, userId: true },
  });
  if (!current) throw memberGone();
  const { count } = await prisma.projectMember.deleteMany({ where: { id: current.id, projectId: project.id } });
  if (count === 0) throw memberGone(); // a second owner tab won the race (EC-008)
  const kickDelivered = current.userId ? await broadcastKick(project.id, current.userId) : true;
  return { memberId: current.id, kickDelivered, boundUserId: current.userId };
}
