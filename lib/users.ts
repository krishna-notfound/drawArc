import 'server-only';

import { type ClerkUserInput, ClerkUserInputSchema, type ClerkWebhookUser } from '@/schemas/clerk';

import type { AuthUser } from './auth';
import { AccessError, AppError } from './errors';
import type { PrismaClient, User } from './generated/prisma/client';

export type { ClerkUserInput } from '@/schemas/clerk';

/** The slice of Prisma these helpers need; tests pass an in-memory fake, production passes `prisma`. */
export type UserDb = Pick<PrismaClient, 'user' | '$transaction'>;

/**
 * A deleted account's email stays reserved this long, so deleting and re-creating an account cannot reset
 * per-account benefits such as a free trial (FR-018, D-043). Enforced by comparing `deletedAt` with the
 * current time when a new account claims the email; no scheduled job.
 */
export const EMAIL_REUSE_HOLD_DAYS = 15;
const EMAIL_REUSE_HOLD_MS = EMAIL_REUSE_HOLD_DAYS * 24 * 60 * 60 * 1000;

/** Placeholder email for rows that must not hold a real address (released or tombstoned rows). */
export function placeholderEmail(id: string): string {
  return `deleted+${id}@invalid`;
}

/** A row written by `user.deleted` for a clerkId we never saw: it exists only to keep that id deleted. */
export function isTombstone(row: Pick<User, 'clerkId' | 'email' | 'deletedAt'>): boolean {
  return row.deletedAt !== null && row.email === placeholderEmail(row.clerkId);
}

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

/** The email belongs to an account deleted less than EMAIL_REUSE_HOLD_DAYS ago (FR-018). */
export class EmailHeldError extends AccessError {
  constructor(
    readonly clerkId: string,
    readonly availableAt: Date,
  ) {
    super('FORBIDDEN', 'recently-deleted');
    this.name = 'EmailHeldError';
  }
}

/** The email is linked to a different live Clerk account; retrying cannot fix it (EC-007). */
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

export interface UpsertUserOptions {
  /** Only `requireUser` (a live Clerk session) passes it: clears `deletedAt` (D-F02-4). */
  resurrect?: boolean;
  /** Clock for the email hold; injectable for tests. */
  now?: () => Date;
}

/**
 * Creates or refreshes the row for `input.clerkId`. Webhook upserts never clear `deletedAt`, so a stale
 * `user.updated` after `user.deleted` cannot revive the row (EC-006).
 *
 * When the email is taken by another account: a live owner is a conflict (EC-007); a soft-deleted owner
 * holds it for EMAIL_REUSE_HOLD_DAYS (EmailHeldError), after which its email is released to a placeholder and
 * the new row is created in the same transaction (FR-018).
 */
export async function upsertUserFromClerk(db: UserDb, input: ClerkUserInput, opts: UpsertUserOptions = {}): Promise<User> {
  const args = {
    where: { clerkId: input.clerkId },
    create: { ...input, deletedAt: null },
    update: {
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
      ...(opts.resurrect ? { deletedAt: null } : {}),
    },
  };
  try {
    return await db.user.upsert(args);
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const owner = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, clerkId: true, deletedAt: true },
    });
    // Same clerkId: another request created the row first (EC-001); retrying now updates it.
    if (!owner || owner.clerkId === input.clerkId) return db.user.upsert(args);
    if (!owner.deletedAt) throw new EmailConflictError(input.clerkId, owner.clerkId);

    const availableAt = new Date(owner.deletedAt.getTime() + EMAIL_REUSE_HOLD_MS);
    const now = (opts.now ?? (() => new Date()))();
    if (now < availableAt) throw new EmailHeldError(input.clerkId, availableAt);

    return db.$transaction(async (tx) => {
      // Conditional on the row still being deleted and holding the email, so a concurrent change is not overwritten.
      await tx.user.updateMany({
        where: { id: owner.id, email: input.email, deletedAt: { not: null } },
        data: { email: placeholderEmail(owner.id) },
      });
      return tx.user.upsert(args);
    });
  }
}

/**
 * Sets `deletedAt` (kept if already set); the row and its email are retained, which starts the email hold.
 * An unknown clerkId gets a tombstone so a late `user.created` cannot create a live row (FR-018).
 */
export async function markUserDeleted(db: UserDb, clerkId: string, now: Date = new Date()): Promise<'marked' | 'tombstoned'> {
  const row = await db.user.findUnique({ where: { clerkId }, select: { deletedAt: true } });
  if (row) {
    if (!row.deletedAt) await db.user.update({ where: { clerkId }, data: { deletedAt: now } });
    return 'marked';
  }
  try {
    await db.user.create({ data: { clerkId, email: placeholderEmail(clerkId), name: null, avatarUrl: null, deletedAt: now } });
    return 'tombstoned';
  } catch (err) {
    // A concurrent user.created inserted the row first: mark that one instead.
    if (!isUniqueViolation(err)) throw err;
    const raced = await db.user.findUnique({ where: { clerkId }, select: { deletedAt: true } });
    if (!raced) throw err;
    if (!raced.deletedAt) await db.user.update({ where: { clerkId }, data: { deletedAt: now } });
    return 'marked';
  }
}

/**
 * Binds `ProjectMember` rows invited by `user.email` to `user.id` (PRD-011). F02 fixes the call contract —
 * `requireUser` and the user webhooks call it — and F03 supplies the body once `ProjectMember` exists.
 */
export async function bindPendingMemberships(user: AuthUser): Promise<{ bound: number }> {
  void user;
  return { bound: 0 };
}
