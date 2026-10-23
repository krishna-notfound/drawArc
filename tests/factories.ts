import type { User } from '@/lib/prisma';

/** A complete `User` row with deterministic values; override what the test is about. */
export function makeUser(overrides: Partial<User> = {}): User {
  const createdAt = new Date('2026-10-23T00:00:00.000Z');
  return {
    id: 'user_test_a',
    clerkId: 'user_clerk_test_a',
    email: 'user-a@example.com',
    name: 'User A',
    avatarUrl: 'https://img.clerk.com/user-a',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    ...overrides,
  };
}
