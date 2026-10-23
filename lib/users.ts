import 'server-only';

import { type ClerkUserInput, ClerkUserInputSchema, type ClerkWebhookUser } from '@/schemas/clerk';

import type { AuthUser } from './auth';
import { AppError } from './errors';
import type { PrismaClient, User } from './generated/prisma/client';

export type { ClerkUserInput } from '@/schemas/clerk';

/** The slice of Prisma these helpers need; tests pass an in-memory fake, production passes `prisma`. */
export type UserDb = Pick<PrismaClient, 'user'>;

/** The fields of Clerk's Backend `User` (from `currentUser()`) that we read. The full object never leaves here. */
export interface BackendUserLike {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
}

/** The email is linked to a different Clerk account; retrying cannot fix it (EC-007). */
export class EmailConflictError extends AppError {
  constructor(
    readonly clerkId: string,
    readonly conflictingClerkId: string,
  ) {
    super('CONFLICT', 'This email address is linked to another account.');
    this.name = 'EmailConflictError';
  }
}

interface RawClerkUser {
  clerkId: string;
  emails: { id: string; address: string }[];
  primaryEmailId: string | null | undefined;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  username: string | null | undefined;
  imageUrl: string | null | undefined;
}

function toClerkUserInput(raw: RawClerkUser): ClerkUserInput | null {
  const primary = raw.emails.find((e) => e.id === raw.primaryEmailId) ?? raw.emails[0];
  const fullName = [raw.firstName, raw.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  const parsed = ClerkUserInputSchema.safeParse({
    clerkId: raw.clerkId,
    email: primary?.address.trim().toLowerCase(),
    name: fullName || raw.username?.trim() || null,
    avatarUrl: raw.imageUrl || null,
  });
  return parsed.success ? parsed.data : null;
}

/** Maps Clerk's Backend `User`; `null` when no usable email exists (EC-003). */
export function mapBackendUser(u: BackendUserLike): ClerkUserInput | null {
  return toClerkUserInput({
    clerkId: u.id,
    emails: u.emailAddresses.map((e) => ({ id: e.id, address: e.emailAddress })),
    primaryEmailId: u.primaryEmailAddressId,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    imageUrl: u.imageUrl,
  });
}

/** Maps a (Zod-parsed) `user.created`/`user.updated` webhook payload; `null` when no usable email exists. */
export function mapWebhookUser(d: ClerkWebhookUser): ClerkUserInput | null {
  return toClerkUserInput({
    clerkId: d.id,
    emails: d.email_addresses.map((e) => ({ id: e.id, address: e.email_address })),
    primaryEmailId: d.primary_email_address_id,
    firstName: d.first_name,
    lastName: d.last_name,
    username: d.username,
    imageUrl: d.image_url,
  });
}

export function toAuthUser(row: User): AuthUser {
  return { id: row.id, clerkId: row.clerkId, email: row.email, name: row.name, avatarUrl: row.avatarUrl };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

/**
 * Creates or refreshes the row for `input.clerkId`. Only `requireUser` (a live Clerk session) passes
 * `resurrect`, which clears `deletedAt`; webhook upserts never do, so a stale `user.updated` after
 * `user.deleted` cannot revive the row (EC-006, D-F02-4).
 */
export async function upsertUserFromClerk(
  db: UserDb,
  input: ClerkUserInput,
  opts: { resurrect?: boolean } = {},
): Promise<User> {
  const upsert = () =>
    db.user.upsert({
      where: { clerkId: input.clerkId },
      create: { ...input, deletedAt: null },
      update: {
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl,
        ...(opts.resurrect ? { deletedAt: null } : {}),
      },
    });
  try {
    return await upsert();
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Either another request created this clerkId first (EC-001: retrying now updates that row), or the
    // email belongs to a different account (EC-007), which no retry can fix.
    const owner = await db.user.findUnique({ where: { email: input.email }, select: { clerkId: true } });
    if (owner && owner.clerkId !== input.clerkId) throw new EmailConflictError(input.clerkId, owner.clerkId);
    return upsert();
  }
}

/** Sets `deletedAt` (kept if already set); the row is retained for audit. */
export async function markUserDeleted(db: UserDb, clerkId: string): Promise<'marked' | 'missing'> {
  const row = await db.user.findUnique({ where: { clerkId }, select: { deletedAt: true } });
  if (!row) return 'missing';
  if (!row.deletedAt) await db.user.update({ where: { clerkId }, data: { deletedAt: new Date() } });
  return 'marked';
}

/**
 * Binds `ProjectMember` rows invited by `user.email` to `user.id` (PRD-011). F02 fixes the call contract —
 * `requireUser` and the user webhooks call it — and F03 supplies the body once `ProjectMember` exists.
 */
export async function bindPendingMemberships(user: AuthUser): Promise<{ bound: number }> {
  void user;
  return { bound: 0 };
}
