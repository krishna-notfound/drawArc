// @vitest-environment node
import type { WebhookEvent } from '@clerk/nextjs/webhooks';
import { describe, expect, it, vi } from 'vitest';

import { handleClerkEvent } from '@/lib/clerk-webhook';
import { createFakeLogger } from '@/tests/helpers/fake-logger';
import { createFakeUserDb } from '@/tests/helpers/fake-user-db';

function userEvent(type: 'user.created' | 'user.updated', data: Record<string, unknown> = {}): WebhookEvent {
  return {
    type,
    object: 'event',
    data: {
      id: 'user_clerk_1',
      email_addresses: [{ id: 'e1', email_address: 'Ada@Example.com' }],
      primary_email_address_id: 'e1',
      first_name: 'Ada',
      last_name: null,
      username: null,
      image_url: 'https://img.clerk.com/ada',
      ...data,
    },
  } as unknown as WebhookEvent;
}

function deletedEvent(data: Record<string, unknown> = { id: 'user_clerk_1', deleted: true }): WebhookEvent {
  return { type: 'user.deleted', object: 'event', data } as unknown as WebhookEvent;
}

function setup() {
  const fake = createFakeUserDb();
  const deps = {
    db: fake.db,
    logger: createFakeLogger(),
    bindPendingMemberships: vi.fn(async () => ({ bound: 0 })),
    removeMemberships: vi.fn(async () => ({ removed: 0 })),
  };
  return { fake, deps, handle: (evt: WebhookEvent) => handleClerkEvent(evt, deps) };
}

describe('handleClerkEvent — idempotent and order-tolerant (AC-021)', () => {
  it('ends with one row reflecting the last payload when updated arrives before created (EC-004)', async () => {
    const { fake, handle } = setup();
    await expect(handle(userEvent('user.updated', { first_name: 'Updated' }))).resolves.toEqual({ handled: true });
    await expect(handle(userEvent('user.created', { first_name: 'Created' }))).resolves.toEqual({ handled: true });
    expect(fake.rows()).toHaveLength(1);
    expect(fake.rows()[0]).toMatchObject({ clerkId: 'user_clerk_1', email: 'ada@example.com', name: 'Created' });
  });

  it('keeps one row and answers handled both times when created is replayed (EC-005)', async () => {
    const { fake, handle, deps } = setup();
    await expect(handle(userEvent('user.created'))).resolves.toEqual({ handled: true });
    await expect(handle(userEvent('user.created'))).resolves.toEqual({ handled: true });
    expect(fake.rows()).toHaveLength(1);
    expect(deps.bindPendingMemberships).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@example.com' }));
  });

  it('keeps deletedAt when a stale updated follows deleted (EC-006)', async () => {
    const { fake, deps, handle } = setup();
    await handle(userEvent('user.created'));
    await expect(handle(deletedEvent())).resolves.toEqual({ handled: true });
    expect(deps.removeMemberships).toHaveBeenCalledExactlyOnceWith('user_clerk_1');
    await handle(userEvent('user.updated', { first_name: 'Stale' }));
    expect(fake.rows()).toHaveLength(1);
    expect(fake.rows()[0]?.deletedAt).toBeInstanceOf(Date);
  });

  it('writes a tombstone for an unknown user, so a late created cannot make it live (FR-018, AC-036)', async () => {
    const { fake, handle } = setup();
    await expect(handle(deletedEvent())).resolves.toEqual({ handled: true });
    await expect(handle(userEvent('user.created'))).resolves.toEqual({ handled: false, reason: 'user-deleted' });
    expect(fake.rows()).toHaveLength(1);
    expect(fake.rows()[0]).toMatchObject({
      clerkId: 'user_clerk_1',
      email: 'deleted+user_clerk_1@invalid',
      name: null,
      avatarUrl: null,
    });
    expect(fake.rows()[0]?.deletedAt).toBeInstanceOf(Date);
  });
});

describe('handleClerkEvent — events it does not act on (AC-022)', () => {
  it('ignores unknown event types', async () => {
    const { handle, fake } = setup();
    const evt = { type: 'session.created', object: 'event', data: { id: 'sess_1' } } as unknown as WebhookEvent;
    await expect(handle(evt)).resolves.toEqual({ handled: false, reason: 'unknown-type' });
    expect(fake.writes()).toBe(0);
  });

  it('logs a warning and writes nothing for a user without an email (EC-003)', async () => {
    const { handle, fake, deps } = setup();
    await expect(handle(userEvent('user.created', { email_addresses: [] }))).resolves.toEqual({
      handled: false,
      reason: 'no-email',
    });
    expect(deps.logger.warn).toHaveBeenCalledOnce();
    expect(fake.writes()).toBe(0);
  });

  it('rejects user.deleted without an id', async () => {
    const { handle, fake } = setup();
    await expect(handle(deletedEvent({ deleted: true }))).resolves.toEqual({ handled: false, reason: 'missing-id' });
    expect(fake.writes()).toBe(0);
  });

  it('reports an email owned by another account as email-conflict and logs both Clerk ids (EC-007)', async () => {
    const { handle, deps, fake } = setup();
    await handle(userEvent('user.created', { id: 'user_clerk_other' }));
    const result = await handle(userEvent('user.created'));
    expect(result).toEqual({ handled: false, reason: 'email-conflict' });
    expect(fake.rows()).toHaveLength(1);
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ clerkId: 'user_clerk_1', conflictingClerkId: 'user_clerk_other' }),
      expect.any(String),
    );
  });
});
