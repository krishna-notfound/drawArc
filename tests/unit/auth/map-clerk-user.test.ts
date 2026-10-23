// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { type BackendUserLike, mapBackendUser, mapWebhookUser } from '@/lib/users';
import type { ClerkWebhookUser } from '@/schemas/clerk';

// One matrix, two input shapes: the backend `User` (camelCase, from currentUser()) and the webhook payload
// (snake_case). Lowercased primary email is what pending memberships bind by, so it must be exact (AC-018).
interface Case {
  name: string;
  emails: { id: string; address: string }[];
  primaryId: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  expected: { email: string; name: string | null } | null;
}

const CASES: Case[] = [
  {
    name: 'primary email lowercased, first name only',
    emails: [
      { id: 'e1', address: 'other@example.com' },
      { id: 'e2', address: 'Foo@Example.COM' },
    ],
    primaryId: 'e2',
    firstName: 'Ada',
    lastName: null,
    username: null,
    expected: { email: 'foo@example.com', name: 'Ada' },
  },
  {
    name: 'first + last name',
    emails: [{ id: 'e1', address: 'ada@example.com' }],
    primaryId: 'e1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    username: 'ada',
    expected: { email: 'ada@example.com', name: 'Ada Lovelace' },
  },
  {
    name: 'username when there are no names',
    emails: [{ id: 'e1', address: 'ada@example.com' }],
    primaryId: 'e1',
    firstName: null,
    lastName: null,
    username: 'ada',
    expected: { email: 'ada@example.com', name: 'ada' },
  },
  {
    name: 'null name when there is nothing',
    emails: [{ id: 'e1', address: 'ada@example.com' }],
    primaryId: 'e1',
    firstName: null,
    lastName: null,
    username: null,
    expected: { email: 'ada@example.com', name: null },
  },
  {
    name: 'first address when the primary id matches none',
    emails: [
      { id: 'e1', address: 'First@example.com' },
      { id: 'e2', address: 'second@example.com' },
    ],
    primaryId: 'missing',
    firstName: 'Ada',
    lastName: null,
    username: null,
    expected: { email: 'first@example.com', name: 'Ada' },
  },
  {
    name: 'null when there are no addresses',
    emails: [],
    primaryId: null,
    firstName: 'Ada',
    lastName: null,
    username: null,
    expected: null,
  },
];

const IMAGE = 'https://img.clerk.com/abc?width=64';

function backend(c: Case): BackendUserLike {
  return {
    id: 'user_clerk_1',
    firstName: c.firstName,
    lastName: c.lastName,
    username: c.username,
    imageUrl: IMAGE,
    primaryEmailAddressId: c.primaryId,
    emailAddresses: c.emails.map((e) => ({ id: e.id, emailAddress: e.address })),
  };
}

function webhook(c: Case): ClerkWebhookUser {
  return {
    id: 'user_clerk_1',
    first_name: c.firstName,
    last_name: c.lastName,
    username: c.username,
    image_url: IMAGE,
    primary_email_address_id: c.primaryId,
    email_addresses: c.emails.map((e) => ({ id: e.id, email_address: e.address })),
  };
}

describe.each([
  ['mapBackendUser', (c: Case) => mapBackendUser(backend(c))],
  ['mapWebhookUser', (c: Case) => mapWebhookUser(webhook(c))],
] as const)('%s (AC-018)', (_label, map) => {
  it.each(CASES)('$name', (c) => {
    const result = map(c);
    if (c.expected === null) {
      expect(result).toBeNull();
      return;
    }
    expect(result).toEqual({ clerkId: 'user_clerk_1', ...c.expected, avatarUrl: IMAGE });
  });
});
