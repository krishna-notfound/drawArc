import 'server-only';

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { AccessError, AppError } from './errors';
import { type Logger, logger } from './logger';
import { prisma } from './prisma';
import {
  type BackendUserLike,
  bindPendingMemberships,
  EmailConflictError,
  mapBackendUser,
  toAuthUser,
  type UserDb,
  upsertUserFromClerk,
} from './users';

/** The only user shape that leaves this module. Clerk's own `User` object never does (FR-014). */
export interface AuthUser {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface RequireUserOptions {
  /** Pages pass `'redirect'`; route handlers and Server Actions keep the default `'throw'` (401). */
  unauthenticated?: 'throw' | 'redirect';
  /** Same-origin path to come back to after sign-in; anything else is dropped (open-redirect guard). */
  returnTo?: string;
}

export interface RequireUserDeps {
  auth: () => Promise<{ userId: string | null }>;
  currentUser: () => Promise<BackendUserLike | null>;
  db: UserDb;
  bindPendingMemberships: (user: AuthUser) => Promise<{ bound: number }>;
  redirect: (url: string) => never;
  logger: Logger;
}

const SIGN_IN_PATH = '/sign-in';

function isSafeReturnPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}

export function signInUrl(returnTo?: string): string {
  if (!returnTo || !isSafeReturnPath(returnTo)) return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?redirect_url=${encodeURIComponent(returnTo)}`;
}

/** Builds `requireUser` around injectable Clerk/DB seams so tests never mock SDK internals (G-3). */
export function createRequireUser(deps: RequireUserDeps) {
  return async function requireUser(opts: RequireUserOptions = {}): Promise<{ user: AuthUser }> {
    const unauthenticated = (): never => {
      if (opts.unauthenticated === 'redirect') deps.redirect(signInUrl(opts.returnTo));
      throw new AccessError('UNAUTHENTICATED');
    };

    const { userId: clerkId } = await deps.auth();
    if (!clerkId) return unauthenticated();

    const row = await deps.db.user.findUnique({ where: { clerkId } });
    if (row && !row.deletedAt) return { user: toAuthUser(row) };

    // First request for this user, or a row the webhook marked deleted while the Clerk session is still
    // valid (Clerk is authoritative, D-F02-4): sync from Clerk once.
    let backendUser: BackendUserLike | null;
    try {
      backendUser = await deps.currentUser();
    } catch (err) {
      deps.logger.error({ clerkId, err }, 'clerk currentUser() failed');
      throw new AppError('UPSTREAM', 'Could not load your account. Please try again.', { cause: err });
    }
    if (!backendUser) return unauthenticated();

    const input = mapBackendUser(backendUser);
    if (!input) throw new AppError('VALIDATION', 'Your account has no email address');

    let user: AuthUser;
    try {
      user = toAuthUser(await upsertUserFromClerk(deps.db, input, { resurrect: true }));
    } catch (err) {
      if (err instanceof EmailConflictError) {
        deps.logger.error(
          { clerkId, conflictingClerkId: err.conflictingClerkId },
          'user sync refused: email belongs to another account',
        );
      }
      throw err;
    }
    deps.logger.info({ userId: user.id, clerkId, resurrected: Boolean(row) }, 'user row synced from clerk');
    await deps.bindPendingMemberships(user);
    return { user };
  };
}

/**
 * The single authentication entry point: every page (inside a Suspense child), route handler, and Server
 * Action calls it first. Not `'use cache'`: it writes (D-F02-5).
 */
export const requireUser = createRequireUser({
  auth,
  currentUser,
  db: prisma,
  bindPendingMemberships,
  redirect,
  logger,
});
