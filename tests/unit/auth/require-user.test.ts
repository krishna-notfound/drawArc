// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createRequireUser, type RequireUserDeps } from '@/lib/auth';
import { AccessError, AppError } from '@/lib/errors';
import type { BackendUserLike } from '@/lib/users';
import { makeUser } from '@/tests/factories';
import { createFakeLogger } from '@/tests/helpers/fake-logger';
import { createFakeUserDb } from '@/tests/helpers/fake-user-db';

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

const BACKEND_USER: BackendUserLike = {
  id: 'user_clerk_new',
  firstName: 'Ada',
  lastName: 'Lovelace',
  username: null,
  imageUrl: 'https://img.clerk.com/ada',
  primaryEmailAddressId: 'e1',
  emailAddresses: [{ id: 'e1', emailAddress: 'Ada@Example.com' }],
};

function setup(overrides: Partial<RequireUserDeps> = {}, rows = [makeUser()]) {
  const fake = createFakeUserDb(rows);
  const deps = {
    auth: vi.fn(async () => ({ userId: 'user_clerk_new' as string | null })),
    currentUser: vi.fn(async () => BACKEND_USER as BackendUserLike | null),
    db: fake.db,
    bindPendingMemberships: vi.fn(async () => ({ bound: 0 })),
    redirect: vi.fn((url: string): never => {
      throw new RedirectSignal(url);
    }),
    logger: createFakeLogger(),
    ...overrides,
  };
  return { deps, fake, requireUser: createRequireUser(deps) };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (err: unknown) => err,
  );
}

describe('requireUser — unauthenticated (AC-014)', () => {
  const signedOut = { auth: async () => ({ userId: null }) };

  it('throws AccessError UNAUTHENTICATED (401) by default, for handlers and actions', async () => {
    const { requireUser, deps } = setup(signedOut);
    const err = await rejection(requireUser());
    expect(err).toBeInstanceOf(AccessError);
    expect(err).toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    expect(deps.redirect).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, '/sign-in'],
    ['/editor/abc', '/sign-in?redirect_url=%2Feditor%2Fabc'],
    ['https://evil.example', '/sign-in'],
    ['//evil', '/sign-in'],
    ['/\t/evil.com', '/sign-in'],
    ['/\\evil.example', '/sign-in'],
  ])('redirects pages to sign-in (returnTo %s → %s, EC-012)', async (returnTo, expected) => {
    const { requireUser } = setup(signedOut);
    const err = await rejection(requireUser({ unauthenticated: 'redirect', returnTo }));
    expect(err).toBeInstanceOf(RedirectSignal);
    expect((err as RedirectSignal).url).toBe(expected);
  });
});

describe('requireUser — lazy User row (AC-015)', () => {
  it('returns an existing row without calling Clerk or writing', async () => {
    const row = makeUser({ clerkId: 'user_clerk_new' });
    const { requireUser, deps, fake } = setup({}, [row]);
    const { user } = await requireUser();
    expect(user).toEqual({ id: row.id, clerkId: row.clerkId, email: row.email, name: row.name, avatarUrl: row.avatarUrl });
    expect(deps.currentUser).not.toHaveBeenCalled();
    expect(deps.bindPendingMemberships).not.toHaveBeenCalled();
    expect(fake.writes()).toBe(0);
  });

  it('creates the row from currentUser() on first request and binds pending memberships by lowercase email', async () => {
    const { requireUser, deps, fake } = setup();
    const { user } = await requireUser();
    expect(user).toMatchObject({ clerkId: 'user_clerk_new', email: 'ada@example.com', name: 'Ada Lovelace' });
    expect(fake.rows()).toHaveLength(2);
    expect(deps.bindPendingMemberships).toHaveBeenCalledExactlyOnceWith(user);
  });

  it('treats a vanished Clerk user as unauthenticated and writes nothing (EC-002)', async () => {
    const { requireUser, fake } = setup({ currentUser: async () => null });
    expect(await rejection(requireUser())).toMatchObject({ code: 'UNAUTHENTICATED' });
    const redirected = await rejection(requireUser({ unauthenticated: 'redirect' }));
    expect(redirected).toBeInstanceOf(RedirectSignal);
    expect(fake.writes()).toBe(0);
  });

  it('rejects a Clerk user without an email as VALIDATION and writes nothing (EC-003)', async () => {
    const { requireUser, fake, deps } = setup({ currentUser: async () => ({ ...BACKEND_USER, emailAddresses: [] }) });
    const err = await rejection(requireUser());
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: 'VALIDATION', message: 'Your account has no email address' });
    expect(fake.writes()).toBe(0);
    expect(deps.bindPendingMemberships).not.toHaveBeenCalled();
  });

  it('maps a failing Clerk Backend API call to UPSTREAM (EC-014)', async () => {
    const { requireUser, fake } = setup({
      currentUser: async () => {
        throw new Error('rate limited');
      },
    });
    const err = await rejection(requireUser());
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: 'UPSTREAM' });
    expect(fake.writes()).toBe(0);
  });

  it('never revives a tombstone: Clerk no longer has that user (FR-018)', async () => {
    const tombstone = makeUser({
      clerkId: 'user_clerk_new',
      email: 'deleted+user_clerk_new@invalid',
      name: null,
      avatarUrl: null,
      deletedAt: new Date('2026-10-01T00:00:00Z'),
    });
    const { requireUser, deps, fake } = setup({}, [tombstone]);
    expect(await rejection(requireUser())).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(deps.currentUser).not.toHaveBeenCalled();
    expect(fake.writes()).toBe(0);
  });

  it('refuses to attach a Clerk user to an email another account owns (CONFLICT, no write)', async () => {
    const other = makeUser({ id: 'user_other', clerkId: 'user_clerk_other', email: 'ada@example.com' });
    const { requireUser, fake, deps } = setup({}, [other]);
    expect(await rejection(requireUser())).toMatchObject({ code: 'CONFLICT' });
    expect(fake.rows()).toEqual([other]);
    expect(deps.logger.error).toHaveBeenCalledOnce();
  });
});
